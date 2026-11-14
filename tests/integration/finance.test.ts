import { beforeEach, describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { InAppChannel, Notifier } from "@/lib/notifications/notify";
import type { PaymentProvider, ProviderTransaction } from "@/lib/payments/provider";
import { computePaystackSignature } from "@/lib/payments/signature";
import { generateInvoicesForEstate } from "@/server/jobs/billing";
import { approveBillingRule, createBillingRule, voidInvoice } from "@/server/services/billing";
import { approveLedgerEntry, discardLedgerDraft, publishLedgerEntry, reverseLedgerEntry } from "@/server/services/ledger";
import { initializeInvoicePayment } from "@/server/services/payments";
import { processPaystackWebhook } from "@/server/services/webhooks";
import type { Invoice, LedgerEntry, Payment } from "@/types/domain";
import { clearFirestore, contextFor, count, seedEstate, type SeededEstate } from "./fixtures";

const SECRET = "sk_test_integration";
let a: SeededEstate;
let b: SeededEstate;
const notifier = () => new Notifier([new InAppChannel(adminDb())]);

/** Fake Paystack: records initialisations and answers verify with a configurable transaction. */
function fakeProvider(answer: (reference: string) => Partial<ProviderTransaction> = () => ({})): PaymentProvider & { verifyCalls: number } {
  const amounts = new Map<string, number>();
  return {
    name: "paystack",
    verifyCalls: 0,
    async initialize(input) {
      amounts.set(input.reference, input.amountKobo);
      return { authorizationUrl: `https://checkout.paystack.com/${input.reference}`, reference: input.reference };
    },
    async verify(reference) {
      this.verifyCalls += 1;
      return { reference, status: "success", amountKobo: amounts.get(reference) ?? 0, currency: "NGN", paidAt: new Date(), customerEmail: null, ...answer(reference) };
    },
  };
}

async function approvedRuleAndInvoices(seed: SeededEstate, amountKobo = 2_500_000) {
  const { id } = await createBillingRule(contextFor(seed, "manager"), { name: "Service charge", description: "", frequency: "monthly", amountKobo });
  await approveBillingRule(contextFor(seed, "exco"), id);
  return generateInvoicesForEstate(adminDb(), notifier(), { estateId: seed.estate.id, frequency: "monthly" });
}

async function onlyInvoice(estateId: string): Promise<Invoice> {
  const snapshot = await adminDb().collection(COLLECTIONS.invoices).where("estateId", "==", estateId).get();
  expect(snapshot.size).toBe(1);
  return fromDoc<Invoice>(snapshot.docs[0]!)!;
}

function webhookBody(reference: string, amount: number) {
  return JSON.stringify({ event: "charge.success", data: { reference, status: "success", amount, currency: "NGN", paid_at: new Date().toISOString() } });
}

beforeEach(async () => {
  await clearFirestore();
  a = await seedEstate("estate_a");
  b = await seedEstate("estate_b");
});

describe("invoice generation", () => {
  it("is idempotent per unit and period and reconciles in kobo", async () => {
    const first = await approvedRuleAndInvoices(a);
    expect(first).toMatchObject({ created: 1, skippedExisting: 0, totalKobo: 2_500_000 });
    const again = await generateInvoicesForEstate(adminDb(), notifier(), { estateId: "estate_a", frequency: "monthly" });
    expect(again).toMatchObject({ created: 0, skippedExisting: 1 });
    const invoice = await onlyInvoice("estate_a");
    expect(invoice).toMatchObject({ amountDueKobo: 2_500_000, subtotalKobo: 2_500_000, amountPaidKobo: 0, status: "issued" });
  });

  it("does not bill draft charges and blocks self approval", async () => {
    const { id } = await createBillingRule(contextFor(a, "manager"), { name: "Levy", description: "", frequency: "monthly", amountKobo: 100 });
    expect((await generateInvoicesForEstate(adminDb(), notifier(), { estateId: "estate_a", frequency: "monthly" })).created).toBe(0);
    await expect(approveBillingRule(contextFor(a, "manager"), id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(approveBillingRule(contextFor(b, "exco"), id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("payments and webhooks", () => {
  it("marks an invoice paid only after a signed, provider verified webhook, exactly once", async () => {
    await approvedRuleAndInvoices(a);
    const invoice = await onlyInvoice("estate_a");
    const provider = fakeProvider();
    const { reference } = await initializeInvoicePayment(contextFor(a, "resident"), invoice.id, provider);
    expect((await onlyInvoice("estate_a")).status).toBe("pending_payment");

    const body = webhookBody(reference, 2_500_000);
    const deliver = () =>
      processPaystackWebhook({ db: adminDb(), notifier: notifier(), provider, rawBody: body, signature: computePaystackSignature(body, SECRET), secret: SECRET });

    expect(await deliver()).toEqual({ status: "processed", outcome: "verified" });
    expect(await deliver()).toEqual({ status: "duplicate" });

    const paid = await onlyInvoice("estate_a");
    expect(paid).toMatchObject({ status: "paid", amountPaidKobo: 2_500_000 });
    const payment = fromDoc<Payment>(await adminDb().collection(COLLECTIONS.payments).doc(reference).get())!;
    expect(payment.status).toBe("verified");
    expect(await count(COLLECTIONS.ledgerEntries, "paymentId", reference)).toBe(1);
    expect((await adminDb().collection(COLLECTIONS.receipts).doc(reference).get()).exists).toBe(true);
    expect(provider.verifyCalls).toBe(1);
  });

  it("rejects invalid signatures without touching data", async () => {
    await approvedRuleAndInvoices(a);
    const invoice = await onlyInvoice("estate_a");
    const provider = fakeProvider();
    const { reference } = await initializeInvoicePayment(contextFor(a, "resident"), invoice.id, provider);
    const body = webhookBody(reference, 2_500_000);
    await expect(
      processPaystackWebhook({ db: adminDb(), notifier: notifier(), provider, rawBody: body, signature: computePaystackSignature(body, "wrong"), secret: SECRET }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect((await onlyInvoice("estate_a")).amountPaidKobo).toBe(0);
    expect(provider.verifyCalls).toBe(0);
  });

  it("flags an amount mismatch from the provider and does not apply it", async () => {
    await approvedRuleAndInvoices(a);
    const invoice = await onlyInvoice("estate_a");
    const provider = fakeProvider(() => ({ amountKobo: 100 }));
    const { reference } = await initializeInvoicePayment(contextFor(a, "resident"), invoice.id, provider);
    const body = webhookBody(reference, 2_500_000);
    const result = await processPaystackWebhook({ db: adminDb(), notifier: notifier(), provider, rawBody: body, signature: computePaystackSignature(body, SECRET), secret: SECRET });
    expect(result).toEqual({ status: "processed", outcome: "flagged" });
    expect((await onlyInvoice("estate_a")).amountPaidKobo).toBe(0);
    expect(fromDoc<Payment>(await adminDb().collection(COLLECTIONS.payments).doc(reference).get())!.status).toBe("flagged");
  });

  it("does not let a resident pay another unit's or another estate's invoice", async () => {
    await approvedRuleAndInvoices(a);
    const invoice = await onlyInvoice("estate_a");
    await expect(initializeInvoicePayment(contextFor(b, "resident"), invoice.id, fakeProvider())).rejects.toMatchObject({ code: "not_found" });
    await expect(initializeInvoicePayment(contextFor(a, "resident", { unitId: "other_unit" }), invoice.id, fakeProvider())).rejects.toMatchObject({ code: "forbidden" });
    await expect(voidInvoice(contextFor(b, "manager"), invoice.id, "Not ours")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("ledger publication", () => {
  async function draft(seed: SeededEstate, amountKobo: number, requiredApprovals: 1 | 2 = 1) {
    const ref = adminDb().collection(COLLECTIONS.ledgerEntries).doc();
    await ref.set({
      estateId: seed.estate.id, type: "expense", kind: "original", category: "Security", vendor: "Guard Co", description: "November guard salaries",
      amountKobo, transactionDate: new Date(), status: "draft",
      postings: [{ account: "expense:security", debitKobo: amountKobo, creditKobo: 0 }, { account: "asset:operating_account", debitKobo: 0, creditKobo: amountKobo }],
      evidencePaths: [], source: "manual", paymentId: null, reversesEntryId: null, approvals: [], requiredApprovals,
      createdBy: seed.members.manager.uid, createdByName: "Manager", approvedBy: null, publishedAt: null, publishedBy: null, createdAt: new Date(),
    });
    return ref.id;
  }

  it("requires approval before publishing and keeps published entries immutable", async () => {
    const id = await draft(a, 1_000_000);
    await expect(publishLedgerEntry(contextFor(a, "exco"), id)).rejects.toMatchObject({ code: "conflict" });
    expect(await approveLedgerEntry(contextFor(a, "exco"), id)).toBe("approved");
    await publishLedgerEntry(contextFor(a, "exco"), id);
    await expect(discardLedgerDraft(contextFor(a, "manager"), id)).rejects.toMatchObject({ code: "conflict" });
    const { id: reversalId } = await reverseLedgerEntry(contextFor(a, "manager"), id, "Duplicate entry");
    const reversal = fromDoc<LedgerEntry>(await adminDb().collection(COLLECTIONS.ledgerEntries).doc(reversalId).get())!;
    expect(reversal).toMatchObject({ kind: "reversal", status: "draft", reversesEntryId: id });
    await expect(reverseLedgerEntry(contextFor(a, "manager"), id, "Again")).rejects.toMatchObject({ code: "conflict" });
  });

  it("needs two distinct approvers above the threshold and rejects other estates", async () => {
    const id = await draft(a, 90_000_000, 2);
    expect(await approveLedgerEntry(contextFor(a, "exco"), id)).toBe("draft");
    await expect(approveLedgerEntry(contextFor(a, "exco"), id)).rejects.toMatchObject({ code: "conflict" });
    const second = contextFor(a, "exco", { uid: "estate_a_treasurer" });
    expect(await approveLedgerEntry(second, id)).toBe("approved");
    await expect(publishLedgerEntry(contextFor(b, "exco"), id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("denies approval to Exco members without the permission", async () => {
    const id = await draft(a, 100);
    await expect(approveLedgerEntry(contextFor(a, "exco", { permissions: [] }), id)).rejects.toMatchObject({ code: "forbidden" });
  });
});
