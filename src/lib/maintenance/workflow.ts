import { addDays } from "@/lib/time";
import type { MaintenanceTicket, TicketPriority, TicketStatus } from "@/types/domain";

/** Allowed manager transitions (blueprint section 11). */
const MANAGER_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ["triaged", "assigned", "closed"],
  triaged: ["assigned", "closed"],
  assigned: ["in_progress", "triaged", "closed"],
  in_progress: ["awaiting_parts", "awaiting_resident", "resolved"],
  awaiting_parts: ["in_progress", "resolved"],
  awaiting_resident: ["in_progress", "resolved"],
  resolved: ["closed", "triaged"],
  closed: ["triaged"],
};

export type TicketActor = "manager" | "owner";

export type TransitionDecision = { ok: true } | { ok: false; message: string };

export function canTransition(input: {
  ticket: Pick<MaintenanceTicket, "status" | "resolvedAt" | "closedAt">;
  to: TicketStatus;
  actor: TicketActor;
  now: Date;
  reopenDays: number;
  assigneeUid?: string | null;
  resolutionNotes?: string | null;
}): TransitionDecision {
  const { ticket, to, actor } = input;
  if (ticket.status === to) return { ok: false, message: "The ticket is already in that state." };

  if (actor === "owner") {
    const isReopen = (ticket.status === "resolved" || ticket.status === "closed") && to === "triaged";
    const isConfirm = ticket.status === "resolved" && to === "closed";
    if (!isReopen && !isConfirm) return { ok: false, message: "Residents can only confirm or reopen a resolved ticket." };
    if (isReopen) {
      const reference = ticket.resolvedAt ?? ticket.closedAt;
      if (reference && addDays(reference, input.reopenDays).getTime() < input.now.getTime()) {
        return { ok: false, message: `Tickets can only be reopened within ${input.reopenDays} days of resolution.` };
      }
    }
    return { ok: true };
  }

  if (!MANAGER_TRANSITIONS[ticket.status].includes(to)) {
    return { ok: false, message: `A ticket cannot move from ${STATUS_LABELS[ticket.status]} to ${STATUS_LABELS[to]}.` };
  }
  if (to === "assigned" && !input.assigneeUid) return { ok: false, message: "Choose who the ticket is assigned to." };
  if (to === "resolved" && !input.resolutionNotes?.trim()) {
    return { ok: false, message: "Add resolution notes before resolving the ticket." };
  }
  return { ok: true };
}

export function nextStatusesFor(status: TicketStatus): readonly TicketStatus[] {
  return MANAGER_TRANSITIONS[status];
}

const SLA_HOURS: Record<TicketPriority, number> = { urgent: 4, high: 24, normal: 72, low: 168 };

export function targetSlaFor(priority: TicketPriority, createdAt: Date): Date {
  return new Date(createdAt.getTime() + SLA_HOURS[priority] * 3_600_000);
}

export function isSlaBreached(ticket: Pick<MaintenanceTicket, "status" | "targetSlaAt">, now: Date): boolean {
  return ticket.status !== "resolved" && ticket.status !== "closed" && ticket.targetSlaAt.getTime() < now.getTime();
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: "New",
  triaged: "Triaged",
  assigned: "Assigned",
  in_progress: "In progress",
  awaiting_parts: "Awaiting parts",
  awaiting_resident: "Awaiting resident",
  resolved: "Resolved",
  closed: "Closed",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = [
  "new",
  "triaged",
  "assigned",
  "in_progress",
  "awaiting_parts",
  "awaiting_resident",
];
