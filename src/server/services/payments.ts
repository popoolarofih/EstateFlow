import "server-only";
import { randomBytes } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { assertSameEstate } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { auditInTransaction, SYSTEM_ACTOR, type AuditActor } from "@/lib/audit/audit";
import { applyPayment, isPayable, outstandingKobo, PaymentApplicationError } from "@/lib/billing/invoices";
import { appBaseUrl, paystackSecretKey } from "@/lib/env";
import { AppError, conflict, forbidden, precondition } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc, fromQuery } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { buildPostings } from "@/lib/ledger/ledger";
import { logger } from "@/lib/logger";
import { formatNaira } from "@/lib/money";
import { memberUidsWithRoles, type Notifier } from "@/lib/notifications/notify";
import { PaystackProvider } from "@/lib/payments/paystack";
import { PaymentProviderError, type PaymentProvider, type ProviderTransaction } from "@/lib/payments/provider";
import { reconcileDecision } from "@/lib/payments/reconcile";
import type { Estate, Invoice, LedgerEntry, Payment, Receipt } from "@/types/domain";
import { appNotifier, type ServiceContext } from "./context";

const REUSE_PENDING_MS = 30 * 60_000;

export function paymentProvider(): PaymentProvider {
  return new PaystackProvider(paystackSecretKey());
}

export function newPaymentReference(): string {
  return `ef_${randomBytes(12).toString("hex")}`;
}

export async function initializeInvoicePayment(
  { context, actor }: ServiceContext,
  invoiceId: string,
  provider: PaymentProvider = paymentProvider(),
): Promise<{ authorizationUrl: string; reference: string }> {
  const db = adminDb();
  const { member, estate, user, profile } = context;
  if (!can(member, "invoice.pay")) throw forbidden();
  if (!estate.paymentConfig.enabled) throw precondition("Online payment is not enabled for your estate yet.");

  const invoiceRef = db.collection(COLLECTIONS.invoices).doc(invoiceId);
  const invoice = assertSameEstate(fromDoc<Invoice>(await invoiceRef.get()), context);
  if (!member.unitId || invoice.unitId !== member.unitId) throw forbidden("This invoice belongs to another unit.");
  if (!isPayable(invoice.status)) throw conflict("This invoice cannot be paid online.");
  const amountKobo = outstandingKobo(invoice);
  if (amountKobo <= 0) throw conflict("This invoice has no outstanding balance.");
  const email = user.email ?? profile?.email ?? null;
  if (!email) throw precondition("Add an email address to your profile to pay online. Paystack sends your receipt there.");

  // Reuse a recent checkout for the same invoice and amount instead of creating duplicates.
  const recent = fromQuery<Payment>(
    await db
      .collection(COLLECTIONS.payments)
      .where("estateId", "==", estate.id)
      .where("invoiceId", "==", invoice.id)
      .where("payerUid", "==", member.uid)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get(),
  )[0];
  if (
    recent?.authorizationUrl &&
    recent.amountKobo === amountKobo &&
    Date.now() - recent.createdAt.getTime() < REUSE_PENDING_MS
  ) {
    return { authorizationUrl: recent.authorizationUrl, reference: recent.providerReference };
  }

  const reference = newPaymentReference();
  const paymentRef = db.collection(COLLECTIONS.payments).doc(reference);
  const payment: Omit<Payment, "id" | "createdAt"> & { createdAt: FieldValue } = {
    estateId: estate.id,
    invoiceId: invoice.id,
    unitId: invoice.unitId,
    payerUid: member.uid,
    payerEmail: email,
    provider: provider.name,
    providerReference: reference,
    amountKobo,
    currency: "NGN",
    status: "pending",
    authorizationUrl: null,
    verifiedAt: null,
    providerPayloadHash: null,
    failureReason: null,
    createdAt: FieldValue.serverTimestamp(),
  };
  await paymentRef.create(payment);

  try {
    const result = await provider.initialize({
      email,
      amountKobo,
      reference,
      callbackUrl: `${appBaseUrl()}/resident/payments/return`,
      metadata: { estateId: estate.id, invoiceId: invoice.id, paymentId: reference },
      subaccountCode: estate.paymentConfig.subaccountCode,
      transactionChargeKobo: estate.paymentConfig.transactionChargeKobo,
    });
    await db.runTransaction(async (tx) => {
      const fresh = fromDoc<Invoice>(await tx.get(invoiceRef));
      tx.update(paymentRef, { authorizationUrl: result.authorizationUrl });
      if (fresh?.status === "issued") tx.update(invoiceRef, { status: "pending_payment" });
      auditInTransaction(db, tx, actor, {
        estateId: estate.id,
        action: "payment.initialized",
        entityType: "payment",
        entityId: reference,
        after: { invoiceId: invoice.id, amountKobo },
      });
    });
    return result;
  } catch (error) {
    await paymentRef.update({
      status: "failed",
      failureReason: error instanceof PaymentProviderError ? error.message : "Checkout could not be started.",
    });
    if (error instanceof PaymentProviderError) throw new AppError("provider_unavailable", error.message);
    throw error;
  }
}

export type ReconcileOutcome =
  | "verified"
  | "already_processed"
  | "failed"
  | "flagged"
  | "pending"
  | "unknown_reference";

/**
 * Idempotently applies a provider confirmed transaction. A payment becomes `verified` only
 * here, inside one transaction that also updates the invoice, posts the ledger income entry,
 * issues the receipt and writes the audit event. Duplicate deliveries are no-ops.
 */
export async function reconcilePayment(
  db: Firestore,
  notifier: Notifier,
  transaction: ProviderTransaction,
  options: { source: "webhook" | "verify"; payloadHash?: string | null; actor?: AuditActor },
): Promise<ReconcileOutcome> {
  const actor = options.actor ?? SYSTEM_ACTOR;
  const paymentRef = db.collection(COLLECTIONS.payments).doc(transaction.reference);

  const outcome = await db.runTransaction(async (tx) => {
    const payment = fromDoc<Payment>(await tx.get(paymentRef));
    if (!payment) return { outcome: "unknown_reference" as const };
    const invoiceRef = db.collection(COLLECTIONS.invoices).doc(payment.invoiceId);
    const invoice = fromDoc<Invoice>(await tx.get(invoiceRef));
    const decision = reconcileDecision(payment, transaction);

    if (decision.outcome === "already_processed") return { outcome: "already_processed" as const, payment };
    if (decision.outcome === "wait") return { outcome: "pending" as const, payment };

    if (decision.outcome === "failed") {
      if (payment.status === "pending") {
        tx.update(paymentRef, { status: "failed", failureReason: decision.reason });
        if (invoice?.status === "pending_payment") tx.update(invoiceRef, { status: "issued" });
      }
      return { outcome: "failed" as const, payment };
    }

    const flag = (reason: string) => {
      tx.update(paymentRef, {
        status: "flagged",
        failureReason: reason,
        providerPayloadHash: options.payloadHash ?? null,
      });
      auditInTransaction(db, tx, actor, {
        estateId: payment.estateId,
        action: "payment.flagged",
        entityType: "payment",
        entityId: payment.id,
        after: { reason, providerAmountKobo: transaction.amountKobo, source: options.source },
      });
      return { outcome: "flagged" as const, payment };
    };

    if (decision.outcome === "flag") return flag(decision.reason);
    if (!invoice || invoice.estateId !== payment.estateId) return flag("Invoice for this payment was not found.");

    let applied;
    try {
      applied = applyPayment(invoice, payment.amountKobo);
    } catch (error) {
      if (error instanceof PaymentApplicationError) return flag(error.message);
      throw error;
    }
    const estate = fromDoc<Estate>(await tx.get(db.collection(COLLECTIONS.estates).doc(payment.estateId)));
    const payer = await tx.get(db.collection(COLLECTIONS.users).doc(payment.payerUid));

    tx.update(paymentRef, {
      status: "verified",
      verifiedAt: FieldValue.serverTimestamp(),
      providerPayloadHash: options.payloadHash ?? null,
      failureReason: null,
    });
    tx.update(invoiceRef, { amountPaidKobo: applied.amountPaidKobo, status: applied.status });

    const ledgerRef = db.collection(COLLECTIONS.ledgerEntries).doc(`led_${payment.id}`);
    const entry: Omit<LedgerEntry, "id" | "createdAt" | "publishedAt"> & {
      createdAt: FieldValue;
      publishedAt: FieldValue;
    } = {
      estateId: payment.estateId,
      type: "income",
      kind: "original",
      category: "Service charge",
      vendor: null,
      // No unit or payer details: the published ledger is visible to every resident.
      description: `Estate dues collection (${invoice.periodKey})`,
      amountKobo: payment.amountKobo,
      transactionDate: transaction.paidAt ?? new Date(),
      status: "published",
      postings: buildPostings({ type: "income", category: "Service charge", amountKobo: payment.amountKobo, source: "payment" }),
      evidencePaths: [],
      source: "payment",
      paymentId: payment.id,
      reversesEntryId: null,
      approvals: [],
      requiredApprovals: 1,
      createdBy: SYSTEM_ACTOR.uid,
      createdByName: SYSTEM_ACTOR.name,
      approvedBy: SYSTEM_ACTOR.uid,
      publishedAt: FieldValue.serverTimestamp(),
      publishedBy: SYSTEM_ACTOR.uid,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.create(ledgerRef, entry);

    const receipt: Omit<Receipt, "id" | "issuedAt"> & { issuedAt: FieldValue } = {
      estateId: payment.estateId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      unitId: invoice.unitId,
      unitLabel: invoice.unitLabel,
      payerUid: payment.payerUid,
      payerName: String(payer.get("displayName") ?? payment.payerEmail),
      receiptNumber: `EF${(estate?.slug ?? "").slice(0, 4).toUpperCase()}${payment.id.slice(3, 13).toUpperCase()}`,
      amountKobo: payment.amountKobo,
      periodKey: invoice.periodKey,
      issuedAt: FieldValue.serverTimestamp(),
    };
    tx.create(db.collection(COLLECTIONS.receipts).doc(payment.id), receipt);

    auditInTransaction(db, tx, actor, {
      estateId: payment.estateId,
      action: "payment.verified",
      entityType: "payment",
      entityId: payment.id,
      before: { paymentStatus: payment.status, invoiceStatus: invoice.status, amountPaidKobo: invoice.amountPaidKobo },
      after: { paymentStatus: "verified", invoiceStatus: applied.status, amountPaidKobo: applied.amountPaidKobo, source: options.source },
    });
    return { outcome: "verified" as const, payment };
  });

  if (outcome.outcome === "verified" && outcome.payment) {
    const finance = await memberUidsWithRoles(db, outcome.payment.estateId, ["manager", "exco"]);
    await notifier.send([outcome.payment.payerUid], {
      estateId: outcome.payment.estateId,
      type: "payment.verified",
      title: "Payment confirmed",
      body: `We received ${formatNaira(outcome.payment.amountKobo)}. Your receipt is ready.`,
      link: `/resident/payments/receipts/${outcome.payment.id}`,
    });
    await notifier.send(finance, {
      estateId: outcome.payment.estateId,
      type: "payment.verified",
      title: "Payment confirmed",
      body: `${formatNaira(outcome.payment.amountKobo)} was verified by the payment provider.`,
      link: "/admin/billing?tab=payments",
    });
  } else if (outcome.outcome === "flagged" && outcome.payment) {
    const managers = await memberUidsWithRoles(db, outcome.payment.estateId, ["manager"]);
    await notifier.send(managers, {
      estateId: outcome.payment.estateId,
      type: "payment.flagged",
      title: "Payment needs review",
      body: "A payment did not match its invoice and was not applied.",
      link: "/admin/billing?tab=payments",
      priority: "high",
    });
  }
  if (outcome.outcome === "unknown_reference") {
    logger.warn("payment reference not found", { reference: transaction.reference, source: options.source });
  }
  return outcome.outcome;
}

/**
 * Confirms a payment by asking the provider directly (used after the checkout redirect and by
 * managers for missed webhooks). The redirect itself is never treated as proof of payment.
 */
export async function verifyPaymentWithProvider(
  { context, actor }: ServiceContext,
  reference: string,
  provider: PaymentProvider = paymentProvider(),
): Promise<{ status: Payment["status"]; outcome: ReconcileOutcome; paymentId: string; invoiceId: string }> {
  const db = adminDb();
  const payment = assertSameEstate(
    fromDoc<Payment>(await db.collection(COLLECTIONS.payments).doc(reference).get()),
    context,
  );
  const isPayer = payment.payerUid === context.member.uid;
  if (!isPayer && !can(context.member, "payment.reverify")) throw forbidden();
  if (payment.status === "verified") {
    return { status: "verified", outcome: "already_processed", paymentId: payment.id, invoiceId: payment.invoiceId };
  }
  let transaction: ProviderTransaction;
  try {
    transaction = await provider.verify(reference);
  } catch (error) {
    if (error instanceof PaymentProviderError) throw new AppError("provider_unavailable", error.message);
    throw error;
  }
  const outcome = await reconcilePayment(db, appNotifier(), transaction, { source: "verify", actor });
  const fresh = fromDoc<Payment>(await db.collection(COLLECTIONS.payments).doc(reference).get());
  return { status: fresh?.status ?? payment.status, outcome, paymentId: payment.id, invoiceId: payment.invoiceId };
}
