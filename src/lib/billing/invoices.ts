import { createHash } from "node:crypto";
import { assertKobo, sumKobo } from "@/lib/money";
import { zonedParts } from "@/lib/time";
import type {
  BillingFrequency,
  BillingRule,
  BillingType,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/types/domain";

export function buildLineItem(input: {
  ruleId: string | null;
  description: string;
  quantity: number;
  unitPriceKobo: number;
}): InvoiceLineItem {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    throw new RangeError("Quantity must be a positive whole number");
  }
  assertKobo(input.unitPriceKobo, "unit price");
  const amountKobo = input.quantity * input.unitPriceKobo;
  assertKobo(amountKobo, "line amount");
  return { ...input, amountKobo };
}

export function computeInvoiceTotals(lineItems: readonly InvoiceLineItem[]): {
  subtotalKobo: number;
  amountDueKobo: number;
} {
  for (const item of lineItems) {
    if (item.amountKobo !== item.quantity * item.unitPriceKobo) {
      throw new RangeError(`Line item "${item.description}" does not reconcile`);
    }
  }
  const subtotalKobo = sumKobo(lineItems.map((item) => item.amountKobo));
  return { subtotalKobo, amountDueKobo: subtotalKobo };
}

export function outstandingKobo(invoice: Pick<Invoice, "amountDueKobo" | "amountPaidKobo">): number {
  return Math.max(0, invoice.amountDueKobo - invoice.amountPaidKobo);
}

const PAYABLE: ReadonlySet<InvoiceStatus> = new Set(["issued", "pending_payment", "partially_paid", "overdue"]);
const VOIDABLE: ReadonlySet<InvoiceStatus> = new Set(["issued", "overdue"]);
const OVERDUE_CANDIDATES: ReadonlySet<InvoiceStatus> = new Set(["issued", "pending_payment", "partially_paid"]);

export function isPayable(status: InvoiceStatus): boolean {
  return PAYABLE.has(status);
}

export function isVoidable(status: InvoiceStatus): boolean {
  return VOIDABLE.has(status);
}

export function shouldMarkOverdue(invoice: Pick<Invoice, "status" | "dueAt">, now: Date): boolean {
  return OVERDUE_CANDIDATES.has(invoice.status) && invoice.dueAt.getTime() < now.getTime();
}

export class PaymentApplicationError extends Error {
  constructor(
    message: string,
    readonly code: "not_payable" | "overpayment" | "invalid_amount",
  ) {
    super(message);
  }
}

/** Applies a verified payment and returns the new paid amount and status. */
export function applyPayment(
  invoice: Pick<Invoice, "status" | "amountDueKobo" | "amountPaidKobo">,
  amountKobo: number,
): { amountPaidKobo: number; status: InvoiceStatus } {
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new PaymentApplicationError("Payment amount must be positive kobo", "invalid_amount");
  }
  if (!isPayable(invoice.status)) {
    throw new PaymentApplicationError(`Invoice in status ${invoice.status} cannot accept payments`, "not_payable");
  }
  const amountPaidKobo = invoice.amountPaidKobo + amountKobo;
  if (amountPaidKobo > invoice.amountDueKobo) {
    throw new PaymentApplicationError("Payment exceeds the outstanding balance", "overpayment");
  }
  const status: InvoiceStatus = amountPaidKobo === invoice.amountDueKobo ? "paid" : "partially_paid";
  return { amountPaidKobo, status };
}

/** "2026-11" for monthly, "2026-Q4" for quarterly, evaluated in the estate timezone. */
export function periodKeyFor(date: Date, frequency: BillingFrequency, timezone: string): string {
  const { year, month } = zonedParts(date, timezone);
  if (frequency === "monthly") return `${year}-${String(month).padStart(2, "0")}`;
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

/** True on the first month of a quarter (Jan, Apr, Jul, Oct). */
export function isQuarterStart(date: Date, timezone: string): boolean {
  return (zonedParts(date, timezone).month - 1) % 3 === 0;
}

/**
 * Deterministic, non sequential invoice id. Generation is idempotent by
 * estateId + unitId + periodKey + billing type (blueprint section 10).
 */
export function invoiceDocId(estateId: string, unitId: string, periodKey: string, billingType: BillingType): string {
  return `inv_${createHash("sha256").update(`${estateId}|${unitId}|${periodKey}|${billingType}`).digest("hex").slice(0, 28)}`;
}

export function lineItemsForPeriod(rules: readonly BillingRule[], frequency: BillingFrequency): InvoiceLineItem[] {
  return rules
    .filter((rule) => rule.status === "approved" && rule.frequency === frequency)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((rule) =>
      buildLineItem({ ruleId: rule.id, description: rule.name, quantity: 1, unitPriceKobo: rule.amountKobo }),
    );
}
