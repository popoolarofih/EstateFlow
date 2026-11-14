import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { audit, SYSTEM_ACTOR, type AuditActor } from "@/lib/audit/audit";
import {
  computeInvoiceTotals,
  invoiceDocId,
  lineItemsForPeriod,
  periodKeyFor,
  shouldMarkOverdue,
} from "@/lib/billing/invoices";
import { fromDoc, fromQuery } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { logger } from "@/lib/logger";
import { formatNaira } from "@/lib/money";
import type { Notifier } from "@/lib/notifications/notify";
import { addDays } from "@/lib/time";
import type { BillingFrequency, BillingRule, Estate, Invoice, Unit } from "@/types/domain";

/**
 * Invoice generation. Shared by the manager "Generate invoices" action and the scheduled
 * Cloud Function. Ids are derived from estate + unit + period + frequency and written with
 * `create()`, so running the job twice never produces duplicate invoices.
 */
export interface GenerationResult {
  periodKey: string;
  created: number;
  skippedExisting: number;
  unitsConsidered: number;
  totalKobo: number;
}

const ALREADY_EXISTS = 6;

export async function generateInvoicesForEstate(
  db: Firestore,
  notifier: Notifier,
  input: { estateId: string; frequency: BillingFrequency; now?: Date; actor?: AuditActor },
): Promise<GenerationResult> {
  const now = input.now ?? new Date();
  const actor = input.actor ?? SYSTEM_ACTOR;
  const estate = fromDoc<Estate>(await db.collection(COLLECTIONS.estates).doc(input.estateId).get());
  if (!estate || estate.status !== "active") throw new Error(`Estate ${input.estateId} is not active`);
  const periodKey = periodKeyFor(now, input.frequency, estate.timezone);

  const rules = fromQuery<BillingRule>(
    await db
      .collection(COLLECTIONS.billingRules)
      .where("estateId", "==", estate.id)
      .where("status", "==", "approved")
      .get(),
  );
  const lineItems = lineItemsForPeriod(rules, input.frequency);
  const result: GenerationResult = { periodKey, created: 0, skippedExisting: 0, unitsConsidered: 0, totalKobo: 0 };
  if (lineItems.length === 0) return result;
  const { subtotalKobo, amountDueKobo } = computeInvoiceTotals(lineItems);
  const dueAt = addDays(now, estate.settings.invoiceDueDays);
  const notifyUids: string[] = [];

  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  const writer = db.bulkWriter();
  writer.onWriteError((error) => {
    if (error.code === ALREADY_EXISTS) {
      result.skippedExisting += 1;
      return false;
    }
    return error.failedAttempts < 3;
  });

  do {
    let query = db
      .collection(COLLECTIONS.units)
      .where("estateId", "==", estate.id)
      .where("occupancyStatus", "==", "occupied")
      .orderBy("__name__")
      .limit(400);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    cursor = page.docs.at(-1);
    for (const unit of fromQuery<Unit>(page)) {
      result.unitsConsidered += 1;
      const id = invoiceDocId(estate.id, unit.id, periodKey, input.frequency);
      const invoice: Omit<Invoice, "id" | "createdAt" | "issuedAt"> & { createdAt: FieldValue; issuedAt: FieldValue } = {
        estateId: estate.id,
        unitId: unit.id,
        unitLabel: unit.label,
        residentUid: unit.residentUids[0] ?? null,
        periodKey,
        billingType: input.frequency,
        lineItems,
        subtotalKobo,
        amountDueKobo,
        amountPaidKobo: 0,
        dueAt,
        status: "issued",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
        issuedAt: FieldValue.serverTimestamp(),
        voidedAt: null,
        voidReason: null,
      };
      void writer
        .create(db.collection(COLLECTIONS.invoices).doc(id), invoice)
        .then(() => {
          result.created += 1;
          result.totalKobo += amountDueKobo;
          notifyUids.push(...unit.residentUids);
        })
        .catch(() => undefined);
    }
    if (page.size < 400) cursor = undefined;
  } while (cursor);
  await writer.close();

  if (result.created > 0) {
    await audit(db, actor, {
      estateId: estate.id,
      action: "invoices.generated",
      entityType: "billingCycle",
      entityId: `${periodKey}_${input.frequency}`,
      after: { ...result },
    });
    await notifier.send(notifyUids, {
      estateId: estate.id,
      type: "invoice.issued",
      title: "New estate dues invoice",
      body: `Your ${periodKey} invoice of ${formatNaira(amountDueKobo)} is ready.`,
      link: "/resident/payments",
    });
  }
  logger.info("invoice generation finished", { estateId: estate.id, ...result });
  return result;
}

/** Marks unpaid invoices past their due date as overdue across all estates (scheduled daily). */
export async function markOverdueInvoices(db: Firestore, notifier: Notifier, now = new Date()): Promise<number> {
  const snapshot = await db
    .collection(COLLECTIONS.invoices)
    .where("status", "in", ["issued", "pending_payment", "partially_paid"])
    .where("dueAt", "<", now)
    .limit(500)
    .get();
  const invoices = fromQuery<Invoice>(snapshot).filter((invoice) => shouldMarkOverdue(invoice, now));
  const writer = db.bulkWriter();
  for (const invoice of invoices) {
    void writer.update(db.collection(COLLECTIONS.invoices).doc(invoice.id), { status: "overdue" }).catch(() => undefined);
  }
  await writer.close();
  for (const invoice of invoices) {
    if (!invoice.residentUid) continue;
    await notifier.send([invoice.residentUid], {
      estateId: invoice.estateId,
      type: "invoice.overdue",
      title: "Invoice overdue",
      body: `Your ${invoice.periodKey} invoice is past its due date.`,
      link: "/resident/payments",
    });
  }
  return invoices.length;
}

/** Reminds residents three days before the due date, once per invoice. */
export async function sendDueSoonReminders(db: Firestore, notifier: Notifier, now = new Date()): Promise<number> {
  const snapshot = await db
    .collection(COLLECTIONS.invoices)
    .where("status", "in", ["issued", "partially_paid"])
    .where("dueAt", ">=", now)
    .where("dueAt", "<", addDays(now, 3))
    .limit(500)
    .get();
  let sent = 0;
  for (const doc of snapshot.docs) {
    if (doc.get("reminderSentAt")) continue;
    const invoice = fromDoc<Invoice>(doc)!;
    await doc.ref.update({ reminderSentAt: FieldValue.serverTimestamp() });
    if (invoice.residentUid) {
      await notifier.send([invoice.residentUid], {
        estateId: invoice.estateId,
        type: "invoice.due_soon",
        title: "Invoice due soon",
        body: `Your ${invoice.periodKey} invoice is due in the next few days.`,
        link: "/resident/payments",
      });
      sent += 1;
    }
  }
  return sent;
}
