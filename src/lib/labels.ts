/** Client safe display labels. Plain language, never internal status names. */
import type { InvoiceStatus, PassStatus, PassType, PaymentStatus, LedgerEntryStatus } from "@/types/domain";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  pending_payment: "Payment started",
  partially_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const PASS_STATUS_LABELS: Record<PassStatus, string> = {
  active: "Active",
  used: "Used",
  revoked: "Revoked",
  expired: "Expired",
};

export const PASS_TYPE_LABELS: Record<PassType, string> = {
  guest: "Guest",
  delivery: "Delivery",
  contractor: "Contractor",
  staff: "Domestic staff",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Awaiting confirmation",
  verified: "Payment confirmed",
  failed: "Payment failed",
  flagged: "Needs review",
};

export const LEDGER_STATUS_LABELS: Record<LedgerEntryStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  published: "Published",
};

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
