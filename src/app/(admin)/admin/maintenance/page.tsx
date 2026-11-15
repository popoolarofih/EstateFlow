import { Wrench } from "@/components/ui/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { PriorityBadge, TicketStatusBadge } from "@/components/ui/status-badges";
import { Table, Td, Th } from "@/components/ui/table";
import { LinkTabs } from "@/components/ui/tabs";
import { requirePageContext } from "@/lib/auth/authorize";
import { isSlaBreached, STATUS_LABELS } from "@/lib/maintenance/workflow";
import { formatDateTime } from "@/lib/time";
import { estateTickets } from "@/server/repositories";
import { TICKET_STATUSES, type TicketStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Maintenance" };

async function Maintenance({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [context, params] = await Promise.all([requirePageContext("maintenance.viewAll"), searchParams]);
  const raw = typeof params.status === "string" ? params.status : "open";
  const status = raw === "all" || (TICKET_STATUSES as readonly string[]).includes(raw) ? (raw as TicketStatus | "all") : "open";
  const tickets = await estateTickets(context, status);
  const now = new Date();
  const tz = context.estate.timezone;
  return (
    <>
      <PageHeader title="Maintenance" description="Triage, assign and resolve resident requests. Overdue tickets are flagged against their target response time." />
      <LinkTabs
        label="Filter tickets"
        current={status}
        tabs={[
          { key: "open", label: "Open", href: "/admin/maintenance" },
          ...(["new", "assigned", "in_progress", "resolved", "closed"] as const).map((value) => ({ key: value, label: STATUS_LABELS[value], href: `/admin/maintenance?status=${value}` })),
          { key: "all", label: "All", href: "/admin/maintenance?status=all" },
        ]}
      />
      {tickets.length === 0 ? (
        <EmptyState icon={<Wrench size={24} />} title="Nothing to triage" description="New resident requests will appear here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Ticket</Th>
              <Th>Unit</Th>
              <Th>Priority</Th>
              <Th>Target</Th>
              <Th>Assignee</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <Td>
                  <Link href={`/admin/maintenance/${ticket.id}`} className="title-4 text-violet-ink underline underline-offset-4">
                    {ticket.title}
                  </Link>
                  <span className="block caption-2 text-muted">{ticket.category}</span>
                </Td>
                <Td>{ticket.unitLabel}</Td>
                <Td>
                  <PriorityBadge priority={ticket.priority} />
                </Td>
                <Td>
                  {formatDateTime(ticket.targetSlaAt, tz)}
                  {isSlaBreached(ticket, now) && (
                    <span className="mt-1 block">
                      <Badge tone="alert">Past target</Badge>
                    </span>
                  )}
                </Td>
                <Td>{ticket.assignedToName ?? "Unassigned"}</Td>
                <Td>
                  <TicketStatusBadge status={ticket.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export default function AdminMaintenancePage({ searchParams }: PageProps<"/admin/maintenance">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Maintenance searchParams={searchParams} />
    </Suspense>
  );
}
