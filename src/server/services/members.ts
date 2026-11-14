import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { z } from "zod";
import { assertSameEstate, getActiveMemberships } from "@/lib/auth/authorize";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { revokeUserSessions, type SessionUser } from "@/lib/auth/session";
import { auditInTransaction, type AuditActor } from "@/lib/audit/audit";
import { appBaseUrl } from "@/lib/env";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc, fromQuery } from "@/lib/firestore/convert";
import { COLLECTIONS, memberDocId } from "@/lib/firestore/paths";
import { addDays } from "@/lib/time";
import type { createInviteSchema, updateMemberSchema } from "@/lib/validation/members";
import type { Estate, EstateMember, Invite, Role, Unit } from "@/types/domain";
import type { ServiceContext } from "./context";

const INVITE_DAYS = 14;
const MAX_RESIDENTS_PER_UNIT = 10;

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface InviteDraft {
  displayName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  unitId: string | null;
  gateIds: string[];
}

export interface CreatedInvite {
  id: string;
  link: string;
  displayName: string;
}

/** Writes an invite inside a transaction or batch; returns the one time link (only shown once). */
export function writeInvite(
  db: Firestore,
  tx: Transaction | FirebaseFirestore.WriteBatch,
  estateId: string,
  draft: InviteDraft,
  actor: AuditActor,
): CreatedInvite {
  const token = randomBytes(32).toString("base64url");
  const ref = db.collection(COLLECTIONS.invites).doc();
  const invite: Omit<Invite, "id" | "createdAt"> & { createdAt: FieldValue } = {
    estateId,
    email: draft.email,
    phone: draft.phone,
    displayName: draft.displayName,
    role: draft.role,
    unitId: draft.unitId,
    gateIds: draft.gateIds,
    tokenHash: hashInviteToken(token),
    status: "pending",
    expiresAt: addDays(new Date(), INVITE_DAYS),
    createdBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    acceptedBy: null,
    acceptedAt: null,
  };
  (tx as FirebaseFirestore.WriteBatch).create(ref, invite);
  auditInTransaction(db, tx, actor, {
    estateId,
    action: "invite.created",
    entityType: "invite",
    entityId: ref.id,
    after: { role: draft.role, unitId: draft.unitId, email: draft.email ? "provided" : null },
  });
  return { id: ref.id, link: `${appBaseUrl()}/join/${token}`, displayName: draft.displayName };
}

async function assertNotAlreadyInvited(db: Firestore, estateId: string, email: string | null, phone: string | null) {
  for (const [field, value] of [
    ["email", email],
    ["phone", phone],
  ] as const) {
    if (!value) continue;
    const pending = await db
      .collection(COLLECTIONS.invites)
      .where("estateId", "==", estateId)
      .where(field, "==", value)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!pending.empty) throw conflict(`There is already a pending invitation for this ${field}.`);
    if (field === "email") {
      const member = await db
        .collection(COLLECTIONS.estateMembers)
        .where("estateId", "==", estateId)
        .where("email", "==", value)
        .limit(1)
        .get();
      if (!member.empty) throw conflict("Someone with this email is already a member of the estate.");
    }
  }
}

export async function createInvite(
  { context, actor }: ServiceContext,
  input: z.output<typeof createInviteSchema>,
): Promise<CreatedInvite> {
  if (!can(context.member, "members.manage")) throw forbidden();
  const db = adminDb();
  const { estate } = context;
  if (input.unitId) {
    assertSameEstate(fromDoc<Unit>(await db.collection(COLLECTIONS.units).doc(input.unitId).get()), context);
  }
  const knownGates = new Set(estate.gates.map((gate) => gate.id));
  if (input.gateIds.some((gateId) => !knownGates.has(gateId))) {
    throw new AppError("validation_failed", "One of the selected gates does not exist.");
  }
  await assertNotAlreadyInvited(db, estate.id, input.email ?? null, input.phone);
  const batch = db.batch();
  const created = writeInvite(
    db,
    batch,
    estate.id,
    {
      displayName: input.displayName,
      email: input.email ?? null,
      phone: input.phone,
      role: input.role,
      unitId: input.role === "resident" ? (input.unitId ?? null) : null,
      gateIds: input.role === "guard" ? input.gateIds : [],
    },
    actor,
  );
  await batch.commit();
  return created;
}

export async function revokeInvite({ context, actor }: ServiceContext, inviteId: string): Promise<void> {
  if (!can(context.member, "members.manage")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.invites).doc(inviteId);
  await db.runTransaction(async (tx) => {
    const invite = assertSameEstate(fromDoc<Invite>(await tx.get(ref)), context);
    if (invite.status !== "pending") throw conflict("Only pending invitations can be revoked.");
    tx.update(ref, { status: "revoked" });
    auditInTransaction(db, tx, actor, {
      estateId: invite.estateId,
      action: "invite.revoked",
      entityType: "invite",
      entityId: inviteId,
      before: { status: "pending" },
      after: { status: "revoked" },
    });
  });
}

export interface InvitePreview {
  estateName: string;
  roleLabel: string;
  displayName: string;
  maskedEmail: string | null;
  expired: boolean;
  status: Invite["status"];
}

function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export async function findInviteByToken(token: string): Promise<Invite | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.invites)
    .where("tokenHash", "==", hashInviteToken(token))
    .limit(1)
    .get();
  return fromQuery<Invite>(snapshot)[0] ?? null;
}

export async function previewInvite(token: string): Promise<InvitePreview | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const invite = await findInviteByToken(token);
  if (!invite) return null;
  const estate = fromDoc<Estate>(await adminDb().collection(COLLECTIONS.estates).doc(invite.estateId).get());
  if (!estate) return null;
  return {
    estateName: estate.name,
    roleLabel: ROLE_LABELS[invite.role],
    displayName: invite.displayName,
    maskedEmail: invite.email ? maskEmail(invite.email) : null,
    expired: invite.expiresAt.getTime() < Date.now(),
    status: invite.status,
  };
}

/** Accepts an invitation for the signed in user and creates the membership atomically. */
export async function acceptInvite(user: SessionUser, token: string, actorMeta: Pick<AuditActor, "ipHash" | "userAgent">) {
  const db = adminDb();
  const invite = await findInviteByToken(token);
  if (!invite) throw notFound("This invitation link is not valid.");
  const inviteRef = db.collection(COLLECTIONS.invites).doc(invite.id);
  const memberRef = db.collection(COLLECTIONS.estateMembers).doc(memberDocId(user.uid, invite.estateId));

  const result = await db.runTransaction(async (tx) => {
    const fresh = fromDoc<Invite>(await tx.get(inviteRef));
    if (!fresh || fresh.status !== "pending") throw conflict("This invitation has already been used or revoked.");
    if (fresh.expiresAt.getTime() < Date.now()) throw conflict("This invitation has expired. Ask your estate manager for a new one.");
    if (fresh.email && fresh.email !== user.email?.toLowerCase()) {
      throw forbidden("This invitation was sent to a different email address. Sign in with that address.");
    }
    if (!fresh.email && fresh.phone && fresh.phone !== user.phone) {
      throw forbidden("This invitation was sent to a different phone number. Sign in with that number.");
    }
    const existing = await tx.get(memberRef);
    if (existing.exists && existing.get("status") === "active") throw conflict("You are already a member of this estate.");
    if (existing.exists && existing.get("status") === "suspended") throw forbidden("Your membership is suspended. Contact the estate manager.");

    let unit: Unit | null = null;
    const unitRef = fresh.unitId ? db.collection(COLLECTIONS.units).doc(fresh.unitId) : null;
    if (unitRef) {
      unit = fromDoc<Unit>(await tx.get(unitRef));
      if (!unit || unit.estateId !== fresh.estateId) throw conflict("The unit on this invitation no longer exists.");
      if (unit.residentUids.length >= MAX_RESIDENTS_PER_UNIT) throw conflict("This unit has reached its resident limit.");
    }
    const userRef = db.collection(COLLECTIONS.users).doc(user.uid);
    const profile = await tx.get(userRef);
    const displayName = String(profile.get("displayName") || fresh.displayName);

    const member: Omit<EstateMember, "id" | "joinedAt"> & { joinedAt: FieldValue } = {
      uid: user.uid,
      estateId: fresh.estateId,
      role: fresh.role,
      unitId: fresh.unitId,
      gateIds: fresh.gateIds,
      status: "active",
      permissions: [],
      displayName,
      email: user.email?.toLowerCase() ?? null,
      joinedAt: FieldValue.serverTimestamp(),
    };
    tx.set(memberRef, member);
    if (unitRef) tx.update(unitRef, { residentUids: FieldValue.arrayUnion(user.uid), occupancyStatus: "occupied" });
    tx.update(inviteRef, { status: "accepted", acceptedBy: user.uid, acceptedAt: FieldValue.serverTimestamp() });
    tx.set(userRef, { activeEstateId: fresh.estateId }, { merge: true });
    auditInTransaction(db, tx, { uid: user.uid, name: displayName, ...actorMeta }, {
      estateId: fresh.estateId,
      action: "member.joined",
      entityType: "estateMember",
      entityId: memberRef.id,
      after: { role: fresh.role, unitId: fresh.unitId, inviteId: fresh.id },
    });
    return { role: fresh.role, estateId: fresh.estateId };
  });
  return result;
}

export async function updateMember(
  { context, actor }: ServiceContext,
  memberId: string,
  input: z.output<typeof updateMemberSchema>,
): Promise<void> {
  if (!can(context.member, "members.manage")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.estateMembers).doc(memberId);
  const before = assertSameEstate(fromDoc<EstateMember>(await ref.get()), context);
  if (before.uid === context.member.uid && (input.role || input.status)) {
    throw forbidden("You cannot change your own role or status. Ask another manager.");
  }
  const knownGates = new Set(context.estate.gates.map((gate) => gate.id));
  if (input.gateIds?.some((gateId) => !knownGates.has(gateId))) {
    throw new AppError("validation_failed", "One of the selected gates does not exist.");
  }
  const nextRole = input.role ?? before.role;
  const nextUnitId = input.unitId === undefined ? before.unitId : input.unitId;
  if (nextRole === "resident" && !nextUnitId) throw new AppError("validation_failed", "Residents must be linked to a unit.");

  await db.runTransaction(async (tx) => {
    const current = fromDoc<EstateMember>(await tx.get(ref));
    if (!current) throw notFound();
    const oldUnitRef = current.unitId ? db.collection(COLLECTIONS.units).doc(current.unitId) : null;
    const newUnitRef = nextRole === "resident" && nextUnitId ? db.collection(COLLECTIONS.units).doc(nextUnitId) : null;
    const newUnit = newUnitRef ? fromDoc<Unit>(await tx.get(newUnitRef)) : null;
    if (newUnitRef && (!newUnit || newUnit.estateId !== context.estate.id)) throw notFound("That unit does not exist.");

    const update: Record<string, unknown> = {
      role: nextRole,
      unitId: nextRole === "resident" ? nextUnitId : null,
      gateIds: nextRole === "guard" ? (input.gateIds ?? current.gateIds) : [],
      permissions: nextRole === "exco" ? (input.permissions ?? current.permissions) : [],
    };
    if (input.status) update.status = input.status;
    tx.update(ref, update);

    const unitChanged = current.unitId !== update.unitId;
    if (oldUnitRef && (unitChanged || input.status === "suspended")) {
      tx.update(oldUnitRef, { residentUids: FieldValue.arrayRemove(current.uid) });
    }
    if (newUnitRef && (unitChanged || (input.status === "active" && current.status === "suspended"))) {
      tx.update(newUnitRef, { residentUids: FieldValue.arrayUnion(current.uid), occupancyStatus: "occupied" });
    }
    auditInTransaction(db, tx, actor, {
      estateId: current.estateId,
      action: "member.updated",
      entityType: "estateMember",
      entityId: memberId,
      before: { role: current.role, status: current.status, unitId: current.unitId, gateIds: current.gateIds, permissions: current.permissions },
      after: update,
    });
  });

  // Role or status changes end every session of that user (blueprint section 8).
  if ((input.role && input.role !== before.role) || (input.status && input.status !== before.status)) {
    await revokeUserSessions(before.uid);
  }
}

export async function switchActiveEstate(user: SessionUser, estateId: string): Promise<void> {
  const memberships = await getActiveMemberships(user.uid);
  if (!memberships.some((member) => member.estateId === estateId)) throw notFound("You are not a member of that estate.");
  await adminDb().collection(COLLECTIONS.users).doc(user.uid).set({ activeEstateId: estateId }, { merge: true });
}
