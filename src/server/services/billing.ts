import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { z } from "zod";
import { assertSameEstate } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { auditInTransaction } from "@/lib/audit/audit";
import { buildLineItem, computeInvoiceTotals, isVoidable } from "@/lib/billing/invoices";
import { conflict, forbidden } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { formatNaira } from "@/lib/money";
import { zonedParts } from "@/lib/time";
import type { billingRuleSchema, manualInvoiceSchema } from "@/lib/validation/billing";
import type { BillingFrequency, BillingRule, Invoice, Unit } from "@/types/domain";
import { generateInvoicesForEstate, type GenerationResult } from "../jobs/billing";
import { appNotifier, type ServiceContext } from "./context";

export async function createBillingRule(
  { context, actor }: ServiceContext,
  input: z.output<typeof billingRuleSchema>,
): Promise<{ id: string }> {
  if (!can(context.member, "billingRule.draft")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.billingRules).doc();
  const batch = db.batch();
  batch.create(ref, {
    estateId: context.estate.id,
    ...input,
    status: "draft",
    createdBy: context.member.uid,
    createdAt: FieldValue.serverTimestamp(),
    approvedBy: null,
    approvedAt: null,
  } satisfies Omit<BillingRule, "id" | "createdAt"> & { createdAt: FieldValue });
  auditInTransaction(db, batch, actor, {
    estateId: context.estate.id,
    action: "billingRule.drafted",
    entityType: "billingRule",
    entityId: ref.id,
    after: { ...input },
  });
  await batch.commit();
  return { id: ref.id };
}

export async function approveBillingRule({ context, actor }: ServiceContext, ruleId: string): Promise<void> {
  if (!can(context.member, "billingRule.approve")) throw forbidden("Only Exco members with approval rights can approve charges.");
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.billingRules).doc(ruleId);
  await db.runTransaction(async (tx) => {
    const rule = assertSameEstate(fromDoc<BillingRule>(await tx.get(ref)), context);
    if (rule.status !== "draft") throw conflict("Only draft charges can be approved.");
    if (rule.createdBy === context.member.uid) throw forbidden("The person who drafted a charge cannot approve it.");
    tx.update(ref, { status: "approved", approvedBy: context.member.uid, approvedAt: FieldValue.serverTimestamp() });
    auditInTransaction(db, tx, actor, {
      estateId: rule.estateId,
      action: "billingRule.approved",
      entityType: "billingRule",
      entityId: ruleId,
      before: { status: rule.status },
      after: { status: "approved", amountKobo: rule.amountKobo },
    });
  });
}

export async function archiveBillingRule({ context, actor }: ServiceContext, ruleId: string): Promise<void> {
  if (!can(context.member, "billingRule.draft") && !can(context.member, "billingRule.approve")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.billingRules).doc(ruleId);
  await db.runTransaction(async (tx) => {
    const rule = assertSameEstate(fromDoc<BillingRule>(await tx.get(ref)), context);
    if (rule.status === "archived") throw conflict("This charge is already archived.");
    tx.update(ref, { status: "archived" });
    auditInTransaction(db, tx, actor, {
      estateId: rule.estateId,
      action: "billingRule.archived",
      entityType: "billingRule",
      entityId: ruleId,
      before: { status: rule.status },
      after: { status: "archived" },
    });
  });
}

export async function generateInvoices(
  { context, actor }: ServiceContext,
  frequency: BillingFrequency,
): Promise<GenerationResult> {
  if (!can(context.member, "invoice.manage")) throw forbidden();
  return generateInvoicesForEstate(adminDb(), appNotifier(), { estateId: context.estate.id, frequency, actor });
}

export async function createManualInvoice(
  { context, actor }: ServiceContext,
  input: z.output<typeof manualInvoiceSchema>,
): Promise<{ id: string }> {
  if (!can(context.member, "invoice.manage")) throw forbidden();
  const db = adminDb();
  const unit = assertSameEstate(fromDoc<Unit>(await db.collection(COLLECTIONS.units).doc(input.unitId).get()), context);
  const lineItems = input.lineItems.map((item) => buildLineItem({ ruleId: null, ...item }));
  const totals = computeInvoiceTotals(lineItems);
  const ref = db.collection(COLLECTIONS.invoices).doc();
  const { dateKey } = zonedParts(new Date(), context.estate.timezone);
  const batch = db.batch();
  batch.create(ref, {
    estateId: context.estate.id,
    unitId: unit.id,
    unitLabel: unit.label,
    residentUid: unit.residentUids[0] ?? null,
    periodKey: dateKey,
    billingType: "one_off",
    lineItems,
    ...totals,
    amountPaidKobo: 0,
    dueAt: new Date(input.dueAt),
    status: "draft",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: context.member.uid,
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
  } satisfies Omit<Invoice, "id" | "createdAt"> & { createdAt: FieldValue });
  auditInTransaction(db, batch, actor, {
    estateId: context.estate.id,
    action: "invoice.drafted",
    entityType: "invoice",
    entityId: ref.id,
    after: { unitId: unit.id, amountDueKobo: totals.amountDueKobo },
  });
  await batch.commit();
  return { id: ref.id };
}

export async function issueInvoice({ context, actor }: ServiceContext, invoiceId: string): Promise<void> {
  if (!can(context.member, "invoice.manage")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.invoices).doc(invoiceId);
  const invoice = await db.runTransaction(async (tx) => {
    const current = assertSameEstate(fromDoc<Invoice>(await tx.get(ref)), context);
    if (current.status !== "draft") throw conflict("Only draft invoices can be issued.");
    tx.update(ref, { status: "issued", issuedAt: FieldValue.serverTimestamp() });
    auditInTransaction(db, tx, actor, {
      estateId: current.estateId,
      action: "invoice.issued",
      entityType: "invoice",
      entityId: invoiceId,
      before: { status: "draft" },
      after: { status: "issued" },
    });
    return current;
  });
  const unit = fromDoc<Unit>(await db.collection(COLLECTIONS.units).doc(invoice.unitId).get());
  await appNotifier().send(unit?.residentUids ?? [], {
    estateId: invoice.estateId,
    type: "invoice.issued",
    title: "New invoice",
    body: `An invoice of ${formatNaira(invoice.amountDueKobo)} was issued to your unit.`,
    link: "/resident/payments",
  });
}

export async function voidInvoice({ context, actor }: ServiceContext, invoiceId: string, reason: string): Promise<void> {
  if (!can(context.member, "invoice.manage")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.invoices).doc(invoiceId);
  await db.runTransaction(async (tx) => {
    const invoice = assertSameEstate(fromDoc<Invoice>(await tx.get(ref)), context);
    if (!isVoidable(invoice.status)) {
      throw conflict("Only issued or overdue invoices without payments in progress can be voided.");
    }
    if (invoice.amountPaidKobo > 0) throw conflict("Invoices with payments cannot be voided.");
    tx.update(ref, { status: "void", voidedAt: FieldValue.serverTimestamp(), voidReason: reason });
    auditInTransaction(db, tx, actor, {
      estateId: invoice.estateId,
      action: "invoice.voided",
      entityType: "invoice",
      entityId: invoiceId,
      before: { status: invoice.status },
      after: { status: "void", reason },
    });
  });
}
