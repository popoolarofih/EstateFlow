import { describe, expect, it } from "vitest";
import {
  applyPayment,
  buildLineItem,
  computeInvoiceTotals,
  invoiceDocId,
  isPayable,
  isVoidable,
  lineItemsForPeriod,
  outstandingKobo,
  PaymentApplicationError,
  periodKeyFor,
  shouldMarkOverdue,
} from "@/lib/billing/invoices";
import type { BillingRule } from "@/types/domain";

const rule = (overrides: Partial<BillingRule>): BillingRule => ({
  id: "r1",
  estateId: "e1",
  name: "Service charge",
  description: "",
  frequency: "monthly",
  amountKobo: 2_500_000,
  status: "approved",
  createdBy: "u1",
  createdAt: new Date(),
  approvedBy: "u2",
  approvedAt: new Date(),
  ...overrides,
});

describe("invoice totals", () => {
  it("computes line amounts and totals in integer kobo", () => {
    const items = [
      buildLineItem({ ruleId: null, description: "Service charge", quantity: 1, unitPriceKobo: 2_500_050 }),
      buildLineItem({ ruleId: null, description: "Waste", quantity: 3, unitPriceKobo: 150_033 }),
    ];
    expect(items[1]!.amountKobo).toBe(450_099);
    expect(computeInvoiceTotals(items)).toEqual({ subtotalKobo: 2_950_149, amountDueKobo: 2_950_149 });
  });

  it("rejects fractional kobo, negative amounts and tampered lines", () => {
    expect(() => buildLineItem({ ruleId: null, description: "x", quantity: 1, unitPriceKobo: 10.5 })).toThrow();
    expect(() => buildLineItem({ ruleId: null, description: "x", quantity: 0, unitPriceKobo: 100 })).toThrow();
    expect(() => buildLineItem({ ruleId: null, description: "x", quantity: 1, unitPriceKobo: -1 })).toThrow();
    expect(() =>
      computeInvoiceTotals([{ ruleId: null, description: "x", quantity: 2, unitPriceKobo: 100, amountKobo: 150 }]),
    ).toThrow(/reconcile/);
  });

  it("only bills approved rules of the requested frequency", () => {
    const items = lineItemsForPeriod(
      [
        rule({ id: "a", name: "Service charge" }),
        rule({ id: "b", name: "Security levy", status: "draft" }),
        rule({ id: "c", name: "Road levy", frequency: "quarterly" }),
        rule({ id: "d", name: "Waste", amountKobo: 300_000 }),
        rule({ id: "e", name: "Old charge", status: "archived" }),
      ],
      "monthly",
    );
    expect(items.map((item) => item.ruleId)).toEqual(["a", "d"]);
  });
});

describe("payment application", () => {
  const invoice = { status: "issued" as const, amountDueKobo: 5_000_000, amountPaidKobo: 0 };

  it("moves to paid on exact payment and part paid on partial", () => {
    expect(applyPayment(invoice, 5_000_000)).toEqual({ amountPaidKobo: 5_000_000, status: "paid" });
    expect(applyPayment(invoice, 1_000_000)).toEqual({ amountPaidKobo: 1_000_000, status: "partially_paid" });
    expect(applyPayment({ ...invoice, status: "overdue", amountPaidKobo: 1_000_000 }, 4_000_000).status).toBe("paid");
  });

  it("rejects overpayment and payments on closed invoices", () => {
    expect(() => applyPayment(invoice, 5_000_001)).toThrow(PaymentApplicationError);
    expect(() => applyPayment({ ...invoice, status: "void" }, 100)).toThrow(/cannot accept/);
    expect(() => applyPayment({ ...invoice, status: "paid" }, 100)).toThrow(PaymentApplicationError);
    expect(() => applyPayment(invoice, 0)).toThrow(PaymentApplicationError);
  });

  it("reports the outstanding balance", () => {
    expect(outstandingKobo({ amountDueKobo: 500, amountPaidKobo: 200 })).toBe(300);
    expect(outstandingKobo({ amountDueKobo: 500, amountPaidKobo: 500 })).toBe(0);
  });

  it("knows which statuses are payable, voidable and overdue candidates", () => {
    expect(isPayable("issued")).toBe(true);
    expect(isPayable("draft")).toBe(false);
    expect(isVoidable("overdue")).toBe(true);
    expect(isVoidable("partially_paid")).toBe(false);
    const due = new Date("2026-11-01T00:00:00Z");
    expect(shouldMarkOverdue({ status: "issued", dueAt: due }, new Date("2026-11-02T00:00:00Z"))).toBe(true);
    expect(shouldMarkOverdue({ status: "paid", dueAt: due }, new Date("2026-11-02T00:00:00Z"))).toBe(false);
    expect(shouldMarkOverdue({ status: "issued", dueAt: due }, new Date("2026-10-31T00:00:00Z"))).toBe(false);
  });
});

describe("periods and idempotent ids", () => {
  it("uses the estate timezone at month and quarter boundaries", () => {
    // 23:30 UTC on 31 Oct is already 1 Nov in Lagos.
    const instant = new Date("2026-10-31T23:30:00Z");
    expect(periodKeyFor(instant, "monthly", "Africa/Lagos")).toBe("2026-11");
    expect(periodKeyFor(instant, "monthly", "UTC")).toBe("2026-10");
    expect(periodKeyFor(instant, "quarterly", "Africa/Lagos")).toBe("2026-Q4");
    expect(periodKeyFor(new Date("2026-03-15T12:00:00Z"), "quarterly", "Africa/Lagos")).toBe("2026-Q1");
  });

  it("derives deterministic, non sequential invoice ids", () => {
    const id = invoiceDocId("e1", "u1", "2026-11", "monthly");
    expect(id).toBe(invoiceDocId("e1", "u1", "2026-11", "monthly"));
    expect(id).not.toBe(invoiceDocId("e1", "u1", "2026-12", "monthly"));
    expect(id).not.toBe(invoiceDocId("e1", "u2", "2026-11", "monthly"));
    expect(id).not.toBe(invoiceDocId("e2", "u1", "2026-11", "monthly"));
    expect(id).not.toBe(invoiceDocId("e1", "u1", "2026-11", "quarterly"));
    expect(id).toMatch(/^inv_[a-f0-9]{28}$/);
  });
});
