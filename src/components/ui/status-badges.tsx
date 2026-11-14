import { EMERGENCY_CATEGORY_LABELS } from "@/lib/emergency/workflow";
import { INVOICE_STATUS_LABELS, LEDGER_STATUS_LABELS, PASS_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/labels";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/maintenance/workflow";
import type {
  EmergencyAlert,
  InvoiceStatus,
  LedgerEntryStatus,
  PassStatus,
  PaymentStatus,
  TicketPriority,
  TicketStatus,
} from "@/types/domain";
import { Badge, type Tone } from "./badge";

const PASS_TONE: Record<PassStatus, Tone> = { active: "teal", used: "neutral", revoked: "alert", expired: "neutral" };
export const PassStatusBadge = ({ status }: { status: PassStatus }) => (
  <Badge tone={PASS_TONE[status]}>{PASS_STATUS_LABELS[status]}</Badge>
);

const INVOICE_TONE: Record<InvoiceStatus, Tone> = {
  draft: "neutral",
  issued: "violet",
  pending_payment: "gold",
  partially_paid: "gold",
  paid: "teal",
  overdue: "alert",
  void: "neutral",
};
export const InvoiceStatusBadge = ({ status }: { status: InvoiceStatus }) => (
  <Badge tone={INVOICE_TONE[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>
);

const PAYMENT_TONE: Record<PaymentStatus, Tone> = { pending: "gold", verified: "teal", failed: "neutral", flagged: "alert" };
export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>
);

const TICKET_TONE: Record<TicketStatus, Tone> = {
  new: "violet",
  triaged: "violet",
  assigned: "gold",
  in_progress: "gold",
  awaiting_parts: "gold",
  awaiting_resident: "gold",
  resolved: "teal",
  closed: "neutral",
};
export const TicketStatusBadge = ({ status }: { status: TicketStatus }) => (
  <Badge tone={TICKET_TONE[status]}>{STATUS_LABELS[status]}</Badge>
);

const PRIORITY_TONE: Record<TicketPriority, Tone> = { low: "neutral", normal: "neutral", high: "gold", urgent: "alert" };
export const PriorityBadge = ({ priority }: { priority: TicketPriority }) => (
  <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABELS[priority]}</Badge>
);

const LEDGER_TONE: Record<LedgerEntryStatus, Tone> = { draft: "neutral", approved: "violet", published: "teal" };
export const LedgerStatusBadge = ({ status }: { status: LedgerEntryStatus }) => (
  <Badge tone={LEDGER_TONE[status]}>{LEDGER_STATUS_LABELS[status]}</Badge>
);

export const EmergencyStatusBadge = ({ alert }: { alert: Pick<EmergencyAlert, "status"> }) => (
  <Badge tone={alert.status === "open" ? "alert" : alert.status === "acknowledged" ? "gold" : "teal"}>
    {alert.status === "open" ? "Not acknowledged" : alert.status === "acknowledged" ? "Acknowledged" : "Resolved"}
  </Badge>
);

export const EmergencyCategoryText = ({ alert }: { alert: Pick<EmergencyAlert, "category"> }) => (
  <>{EMERGENCY_CATEGORY_LABELS[alert.category]}</>
);
