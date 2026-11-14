import "server-only";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { z } from "zod";
import { assertSameEstate } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { auditInTransaction } from "@/lib/audit/audit";
import { passCodeSecret } from "@/lib/env";
import { AppError, conflict, forbidden, notFound, precondition } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { logger } from "@/lib/logger";
import {
  createQrToken,
  createSixDigitCode,
  hashPassCode,
  hashQrToken,
  passCodeLockId,
  safeEqualHex,
} from "@/lib/passes/codes";
import { defaultMaxUses, evaluatePass, guardMessage, statusAfterUse, type GuardTone } from "@/lib/passes/evaluate";
import { decodeQrPayload, encodeQrPayload } from "@/lib/passes/qr";
import { PASS_TYPE_LABELS } from "@/lib/labels";
import type { createPassSchema, recordExitSchema, verifyPassSchema } from "@/lib/validation/passes";
import type { GateEvent, PassDecisionReason, Unit, VisitorPass } from "@/types/domain";
import { appNotifier, type ServiceContext } from "./context";

const MAX_SINGLE_VISIT_DAYS = 7;
const MAX_STAFF_PASS_DAYS = 180;
const CLOCK_SKEW_MS = 5 * 60_000;

export interface IssuedPass {
  passId: string;
  code: string;
  qrPayload: string;
  guestName: string;
  unitLabel: string;
  validFrom: Date;
  validUntil: Date;
  passType: VisitorPass["passType"];
}

function newPassId(): string {
  return `pass_${randomBytes(12).toString("base64url")}`;
}

export async function createVisitorPass(
  { context, actor }: ServiceContext,
  input: z.output<typeof createPassSchema>,
  now = new Date(),
): Promise<IssuedPass> {
  const db = adminDb();
  const { member, estate } = context;
  if (!can(member, "pass.create")) throw forbidden();
  if (!member.unitId) throw precondition("Your membership is not linked to a unit yet. Contact your estate manager.");

  const unit = assertSameEstate(fromDoc<Unit>(await db.collection(COLLECTIONS.units).doc(member.unitId).get()), context);
  if (!unit.residentUids.includes(member.uid)) throw forbidden("You are not listed as a resident of this unit.");

  const validFrom = new Date(input.validFrom);
  const validUntil = new Date(input.validUntil);
  if (validUntil.getTime() <= now.getTime()) throw new AppError("validation_failed", "The pass would already be expired.");
  if (validFrom.getTime() < now.getTime() - CLOCK_SKEW_MS) {
    throw new AppError("validation_failed", "The start time cannot be in the past.");
  }
  const maxDays = input.passType === "staff" ? MAX_STAFF_PASS_DAYS : MAX_SINGLE_VISIT_DAYS;
  if (validUntil.getTime() - validFrom.getTime() > maxDays * 86_400_000) {
    throw new AppError("validation_failed", `This pass type can last at most ${maxDays} days.`);
  }
  const gateIds = new Set(estate.gates.map((gate) => gate.id));
  if (input.allowedGateIds.some((gateId) => !gateIds.has(gateId))) {
    throw new AppError("validation_failed", "One of the selected gates does not exist.");
  }

  const activeCount = await db
    .collection(COLLECTIONS.visitorPasses)
    .where("estateId", "==", estate.id)
    .where("unitId", "==", unit.id)
    .where("status", "==", "active")
    .count()
    .get();
  if (activeCount.data().count >= estate.settings.maxActivePassesPerUnit) {
    throw conflict(`Your unit already has ${estate.settings.maxActivePassesPerUnit} active passes. Revoke one first.`);
  }

  const secret = passCodeSecret();
  const passId = newPassId();
  const qrToken = createQrToken();
  const passRef = db.collection(COLLECTIONS.visitorPasses).doc(passId);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = createSixDigitCode();
    const codeHash = hashPassCode(estate.id, code, secret);
    const lockRef = db.collection(COLLECTIONS.passCodes).doc(passCodeLockId(estate.id, codeHash));
    const created = await db.runTransaction(async (tx) => {
      const lock = await tx.get(lockRef);
      if (lock.exists && (lock.get("validUntil") as FirebaseFirestore.Timestamp).toMillis() > now.getTime()) {
        return false; // An unexpired pass in this estate already uses the code; pick another.
      }
      const pass: Omit<VisitorPass, "id" | "createdAt"> & { createdAt: FieldValue } = {
        estateId: estate.id,
        unitId: unit.id,
        unitLabel: unit.label,
        createdByUid: member.uid,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        passType: input.passType,
        codeHash,
        qrTokenHash: hashQrToken(qrToken),
        validFrom,
        validUntil,
        recurrence: input.recurrence ?? null,
        allowedGateIds: input.allowedGateIds,
        status: "active",
        maxUses: defaultMaxUses(input.passType),
        useCount: 0,
        lastUsedAt: null,
        photoPath: null,
        createdAt: FieldValue.serverTimestamp(),
        revokedAt: null,
        revokedBy: null,
      };
      tx.set(lockRef, { estateId: estate.id, passId, validUntil });
      tx.create(passRef, pass);
      auditInTransaction(db, tx, actor, {
        estateId: estate.id,
        action: "pass.created",
        entityType: "visitorPass",
        entityId: passId,
        after: { passType: input.passType, unitId: unit.id, validFrom, validUntil },
      });
      return true;
    });
    if (created) {
      return {
        passId,
        code,
        qrPayload: encodeQrPayload({ v: 1, passId, estateId: estate.id, token: qrToken }),
        guestName: input.guestName,
        unitLabel: unit.label,
        validFrom,
        validUntil,
        passType: input.passType,
      };
    }
  }
  logger.error("pass code allocation exhausted", { estateId: estate.id });
  throw new AppError("internal", "We could not allocate a pass code. Please try again.");
}

export async function revokeVisitorPass({ context, actor }: ServiceContext, passId: string): Promise<void> {
  const db = adminDb();
  const passRef = db.collection(COLLECTIONS.visitorPasses).doc(passId);
  await db.runTransaction(async (tx) => {
    const pass = assertSameEstate(fromDoc<VisitorPass>(await tx.get(passRef)), context);
    const ownsUnit = context.member.unitId !== null && context.member.unitId === pass.unitId;
    const allowed = can(context.member, "pass.revoke.any") || (can(context.member, "pass.revoke.own") && ownsUnit);
    if (!allowed) throw notFound();
    if (pass.status !== "active") throw conflict("Only active passes can be revoked.");
    tx.update(passRef, { status: "revoked", revokedAt: FieldValue.serverTimestamp(), revokedBy: context.member.uid });
    tx.delete(db.collection(COLLECTIONS.passCodes).doc(passCodeLockId(pass.estateId, pass.codeHash)));
    auditInTransaction(db, tx, actor, {
      estateId: pass.estateId,
      action: "pass.revoked",
      entityType: "visitorPass",
      entityId: passId,
      before: { status: pass.status },
      after: { status: "revoked" },
    });
  });
}

export interface VerificationResult {
  allow: boolean;
  reason: PassDecisionReason;
  tone: GuardTone;
  headline: string;
  detail: string;
  eventId: string;
  unitLabel: string | null;
  guestName: string | null;
  passTypeLabel: string | null;
  validUntil: Date | null;
  priorUseAt: Date | null;
  photoPath: string | null;
  passId: string | null;
}

function assertGuardGate(context: ServiceContext["context"], gateId: string): string {
  const gate = context.estate.gates.find((candidate) => candidate.id === gateId);
  if (!gate || !context.member.gateIds.includes(gateId)) {
    throw forbidden("You are not assigned to this gate.");
  }
  return gate.name;
}

/**
 * Verifies a pass at the gate. Lookups are always scoped to the guard's estate, the decision
 * and the use count increment happen in one transaction, and every attempt is logged.
 */
export async function verifyVisitorPass(
  { context }: ServiceContext,
  input: z.output<typeof verifyPassSchema>,
  now = new Date(),
): Promise<VerificationResult> {
  const db = adminDb();
  const { estate, member } = context;
  if (!can(member, "pass.verify")) throw forbidden();
  assertGuardGate(context, input.gateId);

  let passId: string | null = null;
  let qrTokenHash: string | null = null;
  if (input.method === "code") {
    const codeHash = hashPassCode(estate.id, input.code, passCodeSecret());
    const lock = await db.collection(COLLECTIONS.passCodes).doc(passCodeLockId(estate.id, codeHash)).get();
    passId = lock.exists && lock.get("estateId") === estate.id ? String(lock.get("passId")) : null;
  } else {
    const payload = decodeQrPayload(input.qr);
    // A QR for another estate is indistinguishable from an unknown QR.
    if (payload && payload.estateId === estate.id) {
      passId = payload.passId;
      qrTokenHash = hashQrToken(payload.token);
    }
  }

  const eventRef = db.collection(COLLECTIONS.gateEvents).doc();
  const guardName = context.profile?.displayName || member.displayName;

  const result = await db.runTransaction(async (tx) => {
    let pass: VisitorPass | null = null;
    if (passId) {
      const loaded = fromDoc<VisitorPass>(await tx.get(db.collection(COLLECTIONS.visitorPasses).doc(passId)));
      const matchesEstate = loaded?.estateId === estate.id;
      const matchesToken = qrTokenHash === null || (loaded && safeEqualHex(loaded.qrTokenHash, qrTokenHash));
      pass = loaded && matchesEstate && matchesToken ? loaded : null;
    }
    const evaluation = evaluatePass(pass, { now, gateId: input.gateId, timezone: estate.timezone });

    const event: Omit<GateEvent, "id" | "occurredAt"> & { occurredAt: FieldValue } = {
      estateId: estate.id,
      gateId: input.gateId,
      passId: pass?.id ?? null,
      unitId: pass?.unitId ?? null,
      unitLabel: pass?.unitLabel ?? null,
      guestName: pass?.guestName ?? null,
      passType: pass?.passType ?? null,
      guardUid: member.uid,
      guardName,
      eventType: evaluation.allow ? "entry" : "denied",
      result: evaluation.allow ? "allow" : "deny",
      reason: evaluation.reason,
      method: input.method,
      entryEventId: null,
      expectedDepartureAt:
        evaluation.allow && pass && (pass.passType === "contractor" || pass.passType === "delivery")
          ? pass.validUntil
          : null,
      occurredAt: FieldValue.serverTimestamp(),
      deviceId: null,
      notes: null,
    };
    tx.create(eventRef, event);

    if (evaluation.allow && pass) {
      tx.update(db.collection(COLLECTIONS.visitorPasses).doc(pass.id), {
        useCount: FieldValue.increment(1),
        status: statusAfterUse(pass),
        lastUsedAt: FieldValue.serverTimestamp(),
      });
    }
    return { evaluation, pass };
  });

  const { evaluation, pass } = result;
  const message = guardMessage(evaluation.reason);
  if (evaluation.allow && pass) {
    await appNotifier().send([pass.createdByUid], {
      estateId: estate.id,
      type: "visitor.arrived",
      title: "Your visitor has arrived",
      body: `${pass.guestName} was let in at the gate.`,
      link: "/resident/visitors",
    });
  }
  const revealDetails = pass !== null;
  return {
    allow: evaluation.allow,
    reason: evaluation.reason,
    ...message,
    eventId: eventRef.id,
    unitLabel: revealDetails ? pass!.unitLabel : null,
    guestName: revealDetails ? pass!.guestName : null,
    passTypeLabel: revealDetails ? PASS_TYPE_LABELS[pass!.passType] : null,
    validUntil: revealDetails ? pass!.validUntil : null,
    priorUseAt: evaluation.reason === "already_used" ? (pass?.lastUsedAt ?? null) : null,
    photoPath: revealDetails && pass!.passType === "staff" ? pass!.photoPath : null,
    passId: revealDetails ? pass!.id : null,
  };
}

export async function recordVisitorExit(
  { context }: ServiceContext,
  input: z.output<typeof recordExitSchema>,
): Promise<{ eventId: string }> {
  const db = adminDb();
  const { estate, member } = context;
  if (!can(member, "pass.verify")) throw forbidden();
  assertGuardGate(context, input.gateId);
  const entryRef = db.collection(COLLECTIONS.gateEvents).doc(input.entryEventId);
  const exitRef = db.collection(COLLECTIONS.gateEvents).doc();

  await db.runTransaction(async (tx) => {
    const entry = assertSameEstate(fromDoc<GateEvent>(await tx.get(entryRef)), context);
    if (entry.eventType !== "entry") throw precondition("Only entries can be checked out.");
    const existingExit = await tx.get(
      db
        .collection(COLLECTIONS.gateEvents)
        .where("estateId", "==", estate.id)
        .where("entryEventId", "==", entry.id)
        .limit(1),
    );
    if (!existingExit.empty) throw conflict("This visitor has already been checked out.");
    tx.create(exitRef, {
      estateId: estate.id,
      gateId: input.gateId,
      passId: entry.passId,
      unitId: entry.unitId,
      unitLabel: entry.unitLabel,
      guestName: entry.guestName,
      passType: entry.passType,
      guardUid: member.uid,
      guardName: context.profile?.displayName || member.displayName,
      eventType: "exit",
      result: "allow",
      reason: "exit_recorded",
      method: "list",
      entryEventId: entry.id,
      expectedDepartureAt: null,
      occurredAt: FieldValue.serverTimestamp(),
      deviceId: null,
      notes: null,
    } satisfies Omit<GateEvent, "id" | "occurredAt"> & { occurredAt: FieldValue });
  });
  return { eventId: exitRef.id };
}
