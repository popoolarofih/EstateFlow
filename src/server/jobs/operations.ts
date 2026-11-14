import type { Firestore } from "firebase-admin/firestore";
import { audit, SYSTEM_ACTOR } from "@/lib/audit/audit";
import { EMERGENCY_CATEGORY_LABELS, escalationLevelDue } from "@/lib/emergency/workflow";
import { fromQuery } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { memberUidsWithRoles, type Notifier } from "@/lib/notifications/notify";
import { passCodeLockId } from "@/lib/passes/codes";
import type { EmergencyAlert, GateEvent, VisitorPass } from "@/types/domain";

/** Scheduled operational jobs shared by Cloud Functions and tests. */

/** Marks passes past `validUntil` as expired and releases their code locks. */
export async function expirePasses(db: Firestore, now = new Date()): Promise<number> {
  const snapshot = await db
    .collection(COLLECTIONS.visitorPasses)
    .where("status", "==", "active")
    .where("validUntil", "<", now)
    .limit(500)
    .get();
  const passes = fromQuery<VisitorPass>(snapshot);
  const writer = db.bulkWriter();
  for (const pass of passes) {
    void writer.update(db.collection(COLLECTIONS.visitorPasses).doc(pass.id), { status: "expired" }).catch(() => undefined);
    void writer.delete(db.collection(COLLECTIONS.passCodes).doc(passCodeLockId(pass.estateId, pass.codeHash))).catch(() => undefined);
  }
  await writer.close();
  return passes.length;
}

/** Escalates unacknowledged emergency alerts to managers, then to Exco. */
export async function escalateEmergencies(db: Firestore, notifier: Notifier, now = new Date()): Promise<number> {
  const snapshot = await db.collection(COLLECTIONS.emergencyAlerts).where("status", "==", "open").limit(200).get();
  let escalated = 0;
  for (const alert of fromQuery<EmergencyAlert>(snapshot)) {
    const level = escalationLevelDue(alert, now);
    if (level === null) continue;
    const updated = await db.runTransaction(async (tx) => {
      const ref = db.collection(COLLECTIONS.emergencyAlerts).doc(alert.id);
      const fresh = await tx.get(ref);
      if (fresh.get("status") !== "open" || Number(fresh.get("escalationLevel")) >= level) return false;
      tx.update(ref, { escalationLevel: level });
      return true;
    });
    if (!updated) continue;
    escalated += 1;
    const roles = level >= 2 ? ["guard", "manager", "exco"] : ["guard", "manager"];
    const recipients = await memberUidsWithRoles(db, alert.estateId, roles);
    await notifier.send(recipients, {
      estateId: alert.estateId,
      type: "emergency.escalated",
      title: `Unacknowledged emergency: ${EMERGENCY_CATEGORY_LABELS[alert.category]}`,
      body: `${alert.unitLabel} has had no response for over ${level === 1 ? "2" : "5"} minutes.`,
      link: "/admin/emergencies",
      priority: "high",
    });
    await audit(db, SYSTEM_ACTOR, {
      estateId: alert.estateId,
      action: "emergency.escalated",
      entityType: "emergencyAlert",
      entityId: alert.id,
      after: { escalationLevel: level },
    });
  }
  return escalated;
}

/**
 * Finds contractor and delivery visits still inside after their expected departure and
 * notifies the guards and managers once per visit.
 */
export async function flagOverdueVisits(db: Firestore, notifier: Notifier, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 24 * 3_600_000);
  const entries = fromQuery<GateEvent>(
    await db
      .collection(COLLECTIONS.gateEvents)
      .where("eventType", "==", "entry")
      .where("expectedDepartureAt", "<", now)
      .where("expectedDepartureAt", ">", since)
      .limit(300)
      .get(),
  );
  let flagged = 0;
  for (const entry of entries) {
    const exit = await db
      .collection(COLLECTIONS.gateEvents)
      .where("estateId", "==", entry.estateId)
      .where("entryEventId", "==", entry.id)
      .limit(1)
      .get();
    if (!exit.empty) continue;
    // Gate events stay append only; a separate marker makes the notification once only.
    try {
      await db.collection(COLLECTIONS.visitFlags).doc(entry.id).create({ estateId: entry.estateId, flaggedAt: now });
    } catch {
      continue;
    }
    const recipients = await memberUidsWithRoles(db, entry.estateId, ["guard", "manager"]);
    await notifier.send(recipients, {
      estateId: entry.estateId,
      type: "visit.overdue",
      title: "Visitor overdue",
      body: `${entry.guestName ?? "A visitor"} for ${entry.unitLabel ?? "a unit"} has not checked out.`,
      link: "/guard/activity",
    });
    flagged += 1;
  }
  return flagged;
}

/** Deletes expired rate limit windows. */
export async function cleanupRateLimits(db: Firestore, now = new Date()): Promise<number> {
  const snapshot = await db.collection(COLLECTIONS.rateLimits).where("expiresAt", "<", now).limit(500).get();
  const writer = db.bulkWriter();
  for (const doc of snapshot.docs) void writer.delete(doc.ref).catch(() => undefined);
  await writer.close();
  return snapshot.size;
}
