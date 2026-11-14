/**
 * Domain types shared by server code, Cloud Functions and (as plain data) client components.
 * Firestore Timestamps are converted to `Date` at the repository boundary.
 * Money is always integer kobo.
 */

export const ROLES = ["resident", "guard", "manager", "exco"] as const;
export type Role = (typeof ROLES)[number];

export const MEMBER_STATUSES = ["active", "invited", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/** Permissions that can be granted on top of a role (Exco / Treasurer duties). */
export const GRANTABLE_PERMISSIONS = ["ledger.approve", "ledger.publish", "billingRule.approve"] as const;
export type GrantablePermission = (typeof GRANTABLE_PERMISSIONS)[number];

export interface UserProfile {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  photoURL: string | null;
  /** Estate the user last selected; validated against active memberships on every request. */
  activeEstateId: string | null;
  createdAt: Date;
  disabled: boolean;
}

export interface Gate {
  id: string;
  name: string;
}

export interface EmergencyContact {
  label: string;
  phone: string;
}

export interface EstateSettings {
  maxActivePassesPerUnit: number;
  ticketReopenDays: number;
  /** Expenses at or above this amount need two distinct approvers. 0 disables dual approval. */
  expenseDualApprovalThresholdKobo: number;
  invoiceDueDays: number;
  autoGenerateInvoices: boolean;
}

export interface PaymentConfig {
  enabled: boolean;
  provider: "paystack";
  /** Paystack subaccount code, only when the estate's settlement arrangement is approved. */
  subaccountCode: string | null;
  /** Optional flat platform charge in kobo; only used together with a subaccount. */
  transactionChargeKobo: number | null;
}

export interface Estate {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  timezone: string;
  currency: "NGN";
  status: "active" | "suspended";
  planId: string;
  gates: Gate[];
  settings: EstateSettings;
  paymentConfig: PaymentConfig;
  emergencyContacts: EmergencyContact[];
  createdAt: Date;
  createdBy: string;
}

export interface EstateMember {
  id: string;
  uid: string;
  estateId: string;
  role: Role;
  unitId: string | null;
  gateIds: string[];
  status: MemberStatus;
  permissions: GrantablePermission[];
  displayName: string;
  email: string | null;
  joinedAt: Date;
}

export interface Unit {
  id: string;
  estateId: string;
  label: string;
  block: string | null;
  floor: string | null;
  occupancyStatus: "occupied" | "vacant";
  residentUids: string[];
  billingProfileId: string | null;
  createdAt: Date;
}

export type InviteStatus = "pending" | "accepted" | "revoked";

export interface Invite {
  id: string;
  estateId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: Role;
  unitId: string | null;
  gateIds: string[];
  tokenHash: string;
  status: InviteStatus;
  expiresAt: Date;
  createdBy: string;
  createdAt: Date;
  acceptedBy: string | null;
  acceptedAt: Date | null;
}

export const PASS_TYPES = ["guest", "delivery", "contractor", "staff"] as const;
export type PassType = (typeof PASS_TYPES)[number];
export type PassStatus = "active" | "used" | "revoked" | "expired";

export interface PassRecurrence {
  /** 0 = Sunday ... 6 = Saturday, in the estate timezone. */
  daysOfWeek: number[];
  /** "HH:MM", 24 hour clock in the estate timezone. */
  startTime: string;
  endTime: string;
}

export interface VisitorPass {
  id: string;
  estateId: string;
  unitId: string;
  unitLabel: string;
  createdByUid: string;
  guestName: string;
  guestPhone: string | null;
  passType: PassType;
  codeHash: string;
  qrTokenHash: string;
  validFrom: Date;
  validUntil: Date;
  recurrence: PassRecurrence | null;
  /** Empty means every gate of the estate. */
  allowedGateIds: string[];
  status: PassStatus;
  /** null means unlimited uses inside the validity window (staff passes). */
  maxUses: number | null;
  useCount: number;
  lastUsedAt: Date | null;
  photoPath: string | null;
  createdAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
}

export type PassDecisionReason =
  | "valid"
  | "not_recognised"
  | "expired"
  | "not_yet_valid"
  | "revoked"
  | "already_used"
  | "outside_schedule"
  | "wrong_gate";

export type GateEventType = "entry" | "exit" | "denied";

export interface GateEvent {
  id: string;
  estateId: string;
  gateId: string;
  passId: string | null;
  unitId: string | null;
  unitLabel: string | null;
  guestName: string | null;
  passType: PassType | null;
  guardUid: string;
  guardName: string;
  eventType: GateEventType;
  result: "allow" | "deny";
  reason: PassDecisionReason | "exit_recorded";
  method: "code" | "qr" | "list";
  entryEventId: string | null;
  expectedDepartureAt: Date | null;
  occurredAt: Date;
  deviceId: string | null;
  notes: string | null;
}

export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "pending_payment",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type BillingFrequency = "monthly" | "quarterly";
export type BillingType = BillingFrequency | "one_off";

export interface InvoiceLineItem {
  ruleId: string | null;
  description: string;
  quantity: number;
  unitPriceKobo: number;
  amountKobo: number;
}

export interface Invoice {
  id: string;
  estateId: string;
  unitId: string;
  unitLabel: string;
  residentUid: string | null;
  periodKey: string;
  billingType: BillingType;
  lineItems: InvoiceLineItem[];
  subtotalKobo: number;
  amountDueKobo: number;
  amountPaidKobo: number;
  dueAt: Date;
  status: InvoiceStatus;
  createdAt: Date;
  createdBy: string;
  issuedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
}

export interface BillingRule {
  id: string;
  estateId: string;
  name: string;
  description: string;
  frequency: BillingFrequency;
  amountKobo: number;
  status: "draft" | "approved" | "archived";
  createdBy: string;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
}

export type PaymentStatus = "pending" | "verified" | "failed" | "flagged";

export interface Payment {
  id: string;
  estateId: string;
  invoiceId: string;
  unitId: string;
  payerUid: string;
  payerEmail: string;
  provider: "paystack";
  providerReference: string;
  amountKobo: number;
  currency: "NGN";
  status: PaymentStatus;
  authorizationUrl: string | null;
  verifiedAt: Date | null;
  providerPayloadHash: string | null;
  failureReason: string | null;
  createdAt: Date;
}

export interface Receipt {
  id: string;
  estateId: string;
  invoiceId: string;
  paymentId: string;
  unitId: string;
  unitLabel: string;
  payerUid: string;
  payerName: string;
  receiptNumber: string;
  amountKobo: number;
  periodKey: string;
  issuedAt: Date;
}

export interface Posting {
  account: string;
  debitKobo: number;
  creditKobo: number;
}

export type LedgerEntryType = "income" | "expense";
export type LedgerEntryStatus = "draft" | "approved" | "published";

export interface LedgerApproval {
  uid: string;
  name: string;
  at: Date;
}

export interface LedgerEntry {
  id: string;
  estateId: string;
  type: LedgerEntryType;
  kind: "original" | "reversal";
  category: string;
  vendor: string | null;
  description: string;
  amountKobo: number;
  transactionDate: Date;
  status: LedgerEntryStatus;
  postings: Posting[];
  evidencePaths: string[];
  source: "manual" | "payment";
  paymentId: string | null;
  reversesEntryId: string | null;
  approvals: LedgerApproval[];
  requiredApprovals: 1 | 2;
  createdBy: string;
  createdByName: string;
  approvedBy: string | null;
  publishedAt: Date | null;
  publishedBy: string | null;
  createdAt: Date;
}

export const TICKET_STATUSES = [
  "new",
  "triaged",
  "assigned",
  "in_progress",
  "awaiting_parts",
  "awaiting_resident",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const TICKET_CATEGORIES = [
  "plumbing",
  "electrical",
  "security",
  "waste",
  "roads",
  "generator",
  "water",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export interface MaintenanceTicket {
  id: string;
  estateId: string;
  unitId: string;
  unitLabel: string;
  createdByUid: string;
  createdByName: string;
  category: TicketCategory;
  title: string;
  description: string;
  photoPaths: string[];
  priority: TicketPriority;
  status: TicketStatus;
  assignedToUid: string | null;
  assignedToName: string | null;
  targetSlaAt: Date;
  resolutionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export interface TicketEvent {
  id: string;
  estateId: string;
  type: "created" | "status_change" | "comment" | "assignment";
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  body: string | null;
  actorUid: string;
  actorName: string;
  createdAt: Date;
}

export const EMERGENCY_CATEGORIES = ["security", "medical", "fire", "other"] as const;
export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];
export type EmergencyStatus = "open" | "acknowledged" | "resolved";

export interface EmergencyAlert {
  id: string;
  estateId: string;
  unitId: string;
  unitLabel: string;
  createdByUid: string;
  createdByName: string;
  callbackPhone: string | null;
  category: EmergencyCategory;
  locationText: string;
  status: EmergencyStatus;
  escalationLevel: number;
  createdAt: Date;
  acknowledgedBy: string | null;
  acknowledgedByName: string | null;
  acknowledgedAt: Date | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
}

export interface AuditLog {
  id: string;
  estateId: string;
  actorUid: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
  ipHash: string | null;
  userAgent: string | null;
}

export interface AppNotification {
  id: string;
  estateId: string;
  uid: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  priority: "normal" | "high";
  readAt: Date | null;
  createdAt: Date;
}
