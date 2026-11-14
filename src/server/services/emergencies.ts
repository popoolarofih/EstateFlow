import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { z } from "zod";
import { assertSameEstate } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { auditInTransaction } from "@/lib/audit/audit";
import { EMERGENCY_CATEGORY_LABELS, canAcknowledge, canResolve } from "@/lib/emergency/workflow";
import { conflict, forbidden, precondition } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { memberUidsWithRoles } from "@/lib/notifications/notify";
import type { createEmergencySchema } from "@/lib/validation/maintenance";
import type { EmergencyAlert, Unit } from "@/types/domain";
import { appNotifier, type ServiceContext } from "./context";

export async function raiseEmergency(
  { context, actor }: ServiceContext,
  input: z.output<typeof createEmergencySchema>,
): Promise<{ id: string }> {
  if (!can(context.member, "emergency.create")) throw forbidden();
  if (!context.member.unitId) throw precondition("Your membership is not linked to a unit yet.");
  const db = adminDb();
  const unit = assertSameEstate(fromDoc<Unit>(await db.collection(COLLECTIONS.units).doc(context.member.unitId).get()), context);
  const ref = db.collection(COLLECTIONS.emergencyAlerts).doc();
  const alert: Omit<EmergencyAlert, "id" | "createdAt"> & { createdAt: FieldValue } = {
    estateId: context.estate.id,
    unitId: unit.id,
    unitLabel: unit.label,
    createdByUid: context.member.uid,
    createdByName: actor.name,
    callbackPhone: context.profile?.phone ?? context.user.phone ?? null,
    category: input.category,
    locationText: input.locationText,
    status: "open",
    escalationLevel: 0,
    createdAt: FieldValue.serverTimestamp(),
    acknowledgedBy: null,
    acknowledgedByName: null,
    acknowledgedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
  };
  const batch = db.batch();
  batch.create(ref, alert);
  auditInTransaction(db, batch, actor, {
    estateId: context.estate.id,
    action: "emergency.raised",
    entityType: "emergencyAlert",
    entityId: ref.id,
    after: { category: input.category, unitId: unit.id },
  });
  await batch.commit();

  const responders = await memberUidsWithRoles(db, context.estate.id, ["guard", "manager"]);
  await appNotifier().send(responders, {
    estateId: context.estate.id,
    type: "emergency.raised",
    title: `Emergency: ${EMERGENCY_CATEGORY_LABELS[input.category]}`,
    body: `${unit.label}${input.locationText ? `, ${input.locationText}` : ""}. Respond now.`,
    link: "/guard/verify",
    priority: "high",
  });
  return { id: ref.id };
}

export async function acknowledgeEmergency({ context, actor }: ServiceContext, alertId: string): Promise<void> {
  if (!can(context.member, "emergency.acknowledge")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.emergencyAlerts).doc(alertId);
  const alert = await db.runTransaction(async (tx) => {
    const current = assertSameEstate(fromDoc<EmergencyAlert>(await tx.get(ref)), context);
    if (!canAcknowledge(current)) throw conflict("This alert has already been acknowledged.");
    tx.update(ref, {
      status: "acknowledged",
      acknowledgedBy: context.member.uid,
      acknowledgedByName: actor.name,
      acknowledgedAt: FieldValue.serverTimestamp(),
    });
    auditInTransaction(db, tx, actor, {
      estateId: current.estateId,
      action: "emergency.acknowledged",
      entityType: "emergencyAlert",
      entityId: alertId,
      before: { status: current.status },
      after: { status: "acknowledged" },
    });
    return current;
  });
  await appNotifier().send([alert.createdByUid], {
    estateId: alert.estateId,
    type: "emergency.acknowledged",
    title: "Your alert was acknowledged",
    body: `${actor.name} from estate security is responding.`,
    link: "/resident",
    priority: "high",
  });
}

export async function resolveEmergency(
  { context, actor }: ServiceContext,
  alertId: string,
  resolutionNotes: string,
): Promise<void> {
  if (!can(context.member, "emergency.resolve")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.emergencyAlerts).doc(alertId);
  const alert = await db.runTransaction(async (tx) => {
    const current = assertSameEstate(fromDoc<EmergencyAlert>(await tx.get(ref)), context);
    if (!canResolve(current)) throw conflict("This alert is already resolved.");
    const update: Record<string, unknown> = {
      status: "resolved",
      resolvedBy: context.member.uid,
      resolvedAt: FieldValue.serverTimestamp(),
      resolutionNotes,
    };
    if (!current.acknowledgedAt) {
      update.acknowledgedBy = context.member.uid;
      update.acknowledgedByName = actor.name;
      update.acknowledgedAt = FieldValue.serverTimestamp();
    }
    tx.update(ref, update);
    auditInTransaction(db, tx, actor, {
      estateId: current.estateId,
      action: "emergency.resolved",
      entityType: "emergencyAlert",
      entityId: alertId,
      before: { status: current.status },
      after: { status: "resolved", resolutionNotes },
    });
    return current;
  });
  await appNotifier().send([alert.createdByUid], {
    estateId: alert.estateId,
    type: "emergency.resolved",
    title: "Emergency alert resolved",
    body: resolutionNotes,
    link: "/resident",
  });
}

