import { describe, expect, it } from "vitest";
import {
  buildPostings,
  canApprove,
  canDiscard,
  canPublish,
  canReverse,
  isBalanced,
  requiredApprovalsFor,
  reversePostings,
  statusAfterApproval,
  summarizeLedger,
} from "@/lib/ledger/ledger";

describe("double entry postings", () => {
  it("balances income and expense postings", () => {
    const income = buildPostings({ type: "income", category: "Service charge", amountKobo: 5_000_000, source: "payment" });
    const expense = buildPostings({ type: "expense", category: "Generator and diesel", amountKobo: 1_234_567, source: "manual" });
    expect(isBalanced(income)).toBe(true);
    expect(isBalanced(expense)).toBe(true);
    expect(income[0]!.account).toBe("asset:collections");
    expect(expense[0]!.account).toBe("expense:generator_and_diesel");
  });

  it("reverses by swapping debits and credits", () => {
    const postings = buildPostings({ type: "expense", category: "Security", amountKobo: 100, source: "manual" });
    const reversed = reversePostings(postings);
    expect(isBalanced(reversed)).toBe(true);
    expect(reversed[0]).toEqual({ account: postings[0]!.account, debitKobo: 0, creditKobo: 100 });
  });

  it("detects unbalanced or invalid postings", () => {
    expect(isBalanced([{ account: "a", debitKobo: 100, creditKobo: 0 }])).toBe(false);
    expect(isBalanced([{ account: "a", debitKobo: 100, creditKobo: 0 }, { account: "b", debitKobo: 0, creditKobo: 99 }])).toBe(false);
    expect(isBalanced([{ account: "a", debitKobo: -1, creditKobo: 0 }, { account: "b", debitKobo: 0, creditKobo: -1 }])).toBe(false);
    expect(() => buildPostings({ type: "income", category: "x", amountKobo: 0, source: "manual" })).toThrow();
  });
});

describe("approval workflow", () => {
  const draft = { status: "draft" as const, createdBy: "manager", approvals: [] as { uid: string; name: string; at: Date }[], requiredApprovals: 1 as const };

  it("requires two approvers at or above the threshold", () => {
    expect(requiredApprovalsFor(49_999_999, 50_000_000)).toBe(1);
    expect(requiredApprovalsFor(50_000_000, 50_000_000)).toBe(2);
    expect(requiredApprovalsFor(90_000_000, 0)).toBe(1);
  });

  it("blocks self approval and duplicate approval", () => {
    expect(canApprove(draft, "manager").ok).toBe(false);
    expect(canApprove(draft, "exco1").ok).toBe(true);
    expect(canApprove({ ...draft, approvals: [{ uid: "exco1", name: "A", at: new Date() }] }, "exco1").ok).toBe(false);
    expect(canApprove({ ...draft, status: "approved" }, "exco2").ok).toBe(false);
  });

  it("needs every required approval before the entry is approved", () => {
    expect(statusAfterApproval({ approvals: [], requiredApprovals: 1 })).toBe("approved");
    expect(statusAfterApproval({ approvals: [], requiredApprovals: 2 })).toBe("draft");
    expect(statusAfterApproval({ approvals: [{ uid: "a", name: "A", at: new Date() }], requiredApprovals: 2 })).toBe("approved");
  });

  it("publishes approved entries only and keeps published entries immutable", () => {
    expect(canPublish({ status: "draft" }).ok).toBe(false);
    expect(canPublish({ status: "approved" }).ok).toBe(true);
    expect(canPublish({ status: "published" }).ok).toBe(false);
    expect(canDiscard({ status: "published" }).ok).toBe(false);
    expect(canDiscard({ status: "approved" }).ok).toBe(false);
    expect(canDiscard({ status: "draft" }).ok).toBe(true);
    expect(canReverse({ status: "published", kind: "original" }).ok).toBe(true);
    expect(canReverse({ status: "published", kind: "reversal" }).ok).toBe(false);
    expect(canReverse({ status: "draft", kind: "original" }).ok).toBe(false);
  });

  it("summarises only published entries and nets reversals", () => {
    const summary = summarizeLedger([
      { type: "income", kind: "original", amountKobo: 1000, status: "published" },
      { type: "income", kind: "original", amountKobo: 500, status: "draft" },
      { type: "expense", kind: "original", amountKobo: 300, status: "published" },
      { type: "expense", kind: "reversal", amountKobo: 100, status: "published" },
    ]);
    expect(summary).toEqual({ incomeKobo: 1000, expenseKobo: 200, balanceKobo: 800 });
  });
});
