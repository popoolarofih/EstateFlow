import { assertKobo } from "@/lib/money";
import type { LedgerEntry, LedgerEntryType, Posting } from "@/types/domain";

/**
 * Double entry postings behind the simplified income / expense ledger. Every entry must
 * balance (total debits equal total credits).
 */
export const ACCOUNTS = {
  collections: "asset:collections",
  operating: "asset:operating_account",
  income: (category: string) => `income:${slugifyAccount(category)}`,
  expense: (category: string) => `expense:${slugifyAccount(category)}`,
} as const;

function slugifyAccount(category: string): string {
  return category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "general";
}

export function buildPostings(input: {
  type: LedgerEntryType;
  category: string;
  amountKobo: number;
  source: LedgerEntry["source"];
}): Posting[] {
  assertKobo(input.amountKobo);
  if (input.amountKobo === 0) throw new RangeError("Ledger amounts must be greater than zero");
  if (input.type === "income") {
    const debitAccount = input.source === "payment" ? ACCOUNTS.collections : ACCOUNTS.operating;
    return [
      { account: debitAccount, debitKobo: input.amountKobo, creditKobo: 0 },
      { account: ACCOUNTS.income(input.category), debitKobo: 0, creditKobo: input.amountKobo },
    ];
  }
  return [
    { account: ACCOUNTS.expense(input.category), debitKobo: input.amountKobo, creditKobo: 0 },
    { account: ACCOUNTS.operating, debitKobo: 0, creditKobo: input.amountKobo },
  ];
}

export function reversePostings(postings: readonly Posting[]): Posting[] {
  return postings.map((posting) => ({
    account: posting.account,
    debitKobo: posting.creditKobo,
    creditKobo: posting.debitKobo,
  }));
}

export function isBalanced(postings: readonly Posting[]): boolean {
  if (postings.length < 2) return false;
  let debit = 0;
  let credit = 0;
  for (const posting of postings) {
    if (!Number.isSafeInteger(posting.debitKobo) || !Number.isSafeInteger(posting.creditKobo)) return false;
    if (posting.debitKobo < 0 || posting.creditKobo < 0) return false;
    debit += posting.debitKobo;
    credit += posting.creditKobo;
  }
  return debit === credit && debit > 0;
}

/** Two distinct approvers are required at or above a configured threshold (0 disables). */
export function requiredApprovalsFor(amountKobo: number, thresholdKobo: number): 1 | 2 {
  return thresholdKobo > 0 && amountKobo >= thresholdKobo ? 2 : 1;
}

export type LedgerDecision = { ok: true } | { ok: false; message: string };

export function canApprove(
  entry: Pick<LedgerEntry, "status" | "createdBy" | "approvals">,
  approverUid: string,
): LedgerDecision {
  if (entry.status !== "draft") return { ok: false, message: "Only draft entries can be approved." };
  if (entry.createdBy === approverUid) {
    return { ok: false, message: "The person who recorded an entry cannot approve it." };
  }
  if (entry.approvals.some((approval) => approval.uid === approverUid)) {
    return { ok: false, message: "You have already approved this entry." };
  }
  return { ok: true };
}

export function statusAfterApproval(
  entry: Pick<LedgerEntry, "approvals" | "requiredApprovals">,
): "draft" | "approved" {
  return entry.approvals.length + 1 >= entry.requiredApprovals ? "approved" : "draft";
}

export function canPublish(entry: Pick<LedgerEntry, "status">): LedgerDecision {
  if (entry.status === "published") return { ok: false, message: "This entry is already published." };
  if (entry.status !== "approved") return { ok: false, message: "Entries must be approved before publishing." };
  return { ok: true };
}

export function canDiscard(entry: Pick<LedgerEntry, "status">): LedgerDecision {
  if (entry.status !== "draft") {
    return { ok: false, message: "Approved or published entries cannot be deleted. Post a reversal instead." };
  }
  return { ok: true };
}

export function canReverse(entry: Pick<LedgerEntry, "status" | "kind">): LedgerDecision {
  if (entry.status !== "published") return { ok: false, message: "Only published entries can be reversed." };
  if (entry.kind === "reversal") return { ok: false, message: "A reversal cannot itself be reversed." };
  return { ok: true };
}

export interface LedgerSummary {
  incomeKobo: number;
  expenseKobo: number;
  balanceKobo: number;
}

/** Signed totals over published entries; reversals subtract from the type they reverse. */
export function summarizeLedger(
  entries: readonly Pick<LedgerEntry, "type" | "kind" | "amountKobo" | "status">[],
): LedgerSummary {
  let incomeKobo = 0;
  let expenseKobo = 0;
  for (const entry of entries) {
    if (entry.status !== "published") continue;
    const signed = entry.kind === "reversal" ? -entry.amountKobo : entry.amountKobo;
    if (entry.type === "income") incomeKobo += signed;
    else expenseKobo += signed;
  }
  return { incomeKobo, expenseKobo, balanceKobo: incomeKobo - expenseKobo };
}

export const EXPENSE_CATEGORIES = [
  "Security",
  "Waste management",
  "Generator and diesel",
  "Water supply",
  "Repairs and maintenance",
  "Cleaning and landscaping",
  "Staff salaries",
  "Administration",
  "Other",
] as const;

export const INCOME_CATEGORIES = ["Service charge", "Security levy", "Development levy", "Other income"] as const;
