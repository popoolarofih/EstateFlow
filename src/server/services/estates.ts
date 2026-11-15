import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { z } from "zod";
import { can } from "@/lib/auth/permissions";
import { audit, auditInTransaction, type AuditActor } from "@/lib/audit/audit";
import { conflict, forbidden } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import type { createEstateSchema, pilotRequestSchema, updateEstateSchema } from "@/lib/validation/estates";
import type { Estate } from "@/types/domain";
import type { ServiceContext } from "./context";
import { writeInvite, type CreatedInvite } from "./members";

/** No person completes the six field pilot form this fast. */
export const MIN_HUMAN_FILL_MS = 3000;

export const DEFAULT_SETTINGS: Estate["settings"] = {
  maxActivePassesPerUnit: 30,
  ticketReopenDays: 7,
  expenseDualApprovalThresholdKobo: 50_000_000, // ₦500,000
  invoiceDueDays: 14,
  autoGenerateInvoices: false,
};

/** Platform administration: creates an estate and invites its first facility manager. */
export async function createEstate(
  actor: AuditActor,
  input: z.output<typeof createEstateSchema>,
): Promise<{ estateId: string; invite: CreatedInvite }> {
  const db = adminDb();
  const estateRef = db.collection(COLLECTIONS.estates).doc();
  const slugRef = db.collection(COLLECTIONS.estateSlugs).doc(input.slug);
  const gateIds = input.gates.map((gate) => gate.id);
  if (new Set(gateIds).size !== gateIds.length) throw conflict("Gate ids must be unique.");

  const invite = await db.runTransaction(async (tx) => {
    if ((await tx.get(slugRef)).exists) throw conflict("That estate slug is already taken.");
    const estate: Omit<Estate, "id" | "createdAt"> & { createdAt: FieldValue } = {
      name: input.name,
      slug: input.slug,
      address: input.address,
      city: input.city,
      state: input.state,
      timezone: input.timezone,
      currency: "NGN",
      status: "active",
      planId: input.planId,
      gates: input.gates,
      settings: DEFAULT_SETTINGS,
      paymentConfig: { enabled: false, provider: "paystack", subaccountCode: null, transactionChargeKobo: null },
      emergencyContacts: [],
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actor.uid,
    };
    tx.create(slugRef, { estateId: estateRef.id });
    tx.create(estateRef, estate);
    auditInTransaction(db, tx, actor, {
      estateId: estateRef.id,
      action: "estate.created",
      entityType: "estate",
      entityId: estateRef.id,
      after: { name: input.name, slug: input.slug, planId: input.planId },
    });
    return writeInvite(
      db,
      tx,
      estateRef.id,
      { displayName: input.managerName, email: input.managerEmail, phone: null, role: "manager", unitId: null, gateIds: [] },
      actor,
    );
  });
  return { estateId: estateRef.id, invite };
}

export async function updateEstate(
  { context, actor }: ServiceContext,
  input: z.output<typeof updateEstateSchema>,
): Promise<void> {
  if (!can(context.member, "estate.settings")) throw forbidden();
  if (input.gates) {
    const ids = input.gates.map((gate) => gate.id);
    if (new Set(ids).size !== ids.length) throw conflict("Gate ids must be unique.");
  }
  const update: Record<string, unknown> = {};
  if (input.name) update.name = input.name;
  if (input.address) update.address = input.address;
  if (input.gates) update.gates = input.gates;
  if (input.emergencyContacts) update.emergencyContacts = input.emergencyContacts;
  if (input.settings) update.settings = input.settings;
  if (input.paymentConfig) {
    update.paymentConfig = {
      provider: "paystack",
      enabled: input.paymentConfig.enabled,
      subaccountCode: input.paymentConfig.subaccountCode,
      transactionChargeKobo: input.paymentConfig.subaccountCode ? input.paymentConfig.transactionChargeKobo : null,
    };
  }
  if (Object.keys(update).length === 0) return;
  const db = adminDb();
  const before = Object.fromEntries(Object.keys(update).map((key) => [key, context.estate[key as keyof Estate] ?? null]));
  const batch = db.batch();
  batch.update(db.collection(COLLECTIONS.estates).doc(context.estate.id), update);
  auditInTransaction(db, batch, actor, {
    estateId: context.estate.id,
    action: "estate.settings_updated",
    entityType: "estate",
    entityId: context.estate.id,
    before,
    after: update,
  });
  await batch.commit();
}

export async function recordPilotRequest(
  input: z.output<typeof pilotRequestSchema>,
  meta: { ipHash: string | null },
): Promise<void> {
  // Bots fill hidden fields and submit instantly. Accept silently so they learn nothing.
  if (input.website) return;
  if (input.elapsedMs !== undefined && input.elapsedMs < MIN_HUMAN_FILL_MS) return;
  const db = adminDb();
  const ref = await db.collection(COLLECTIONS.pilotRequests).add({
    name: input.name,
    email: input.email,
    phone: input.phone,
    estateName: input.estateName,
    city: input.city,
    units: input.units,
    message: input.message,
    ipHash: meta.ipHash,
    status: "new",
    createdAt: FieldValue.serverTimestamp(),
  });
  await audit(db, { uid: "public", name: input.name, ipHash: meta.ipHash }, {
    estateId: "platform",
    action: "pilot.requested",
    entityType: "pilotRequest",
    entityId: ref.id,
  });
}
