import { ArrowLeft } from "@/components/ui/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/feedback";
import { PriorityBadge, TicketStatusBadge } from "@/components/ui/status-badges";
import { CommentForm, ManagerTicketActions } from "@/components/ui/ticket-actions";
import { TicketPhotos, TicketTimeline } from "@/components/ui/ticket-timeline";
import { requirePageContext } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { nextStatusesFor } from "@/lib/maintenance/workflow";
import { formatDateTime } from "@/lib/time";
import { estateManagers, ticketWithEvents } from "@/server/repositories";

export const metadata: Metadata = { title: "Ticket" };

async function Ticket({ params }: { params: Promise<{ ticketId: string }> }) {
  const [{ ticketId }, context] = await Promise.all([params, requirePageContext("maintenance.viewAll")]);
  const [{ ticket, events }, managers] = await Promise.all([ticketWithEvents(context, ticketId), estateManagers(context)]);
  const canManage = can(context.member, "maintenance.manage");
  const tz = context.estate.timezone;
  return (
    <>
      <Link href="/admin/maintenance" className="inline-flex min-h-12 items-center gap-2 self-start rounded-lg button-sm text-violet-ink">
        <ArrowLeft size={18} aria-hidden /> All tickets
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <TicketStatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="heading-5">{ticket.title}</h1>
            <p className="body-3 whitespace-pre-line">{ticket.description}</p>
            <TicketPhotos paths={ticket.photoPaths} />
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <div className="flex flex-col gap-6">
              <TicketTimeline events={events} timezone={tz} />
              {canManage && ticket.status !== "closed" && <CommentForm ticketId={ticket.id} />}
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid gap-3">
              {(
                [
                  ["Unit", ticket.unitLabel],
                  ["Reported by", ticket.createdByName],
                  ["Reported", formatDateTime(ticket.createdAt, tz)],
                  ["Target response", formatDateTime(ticket.targetSlaAt, tz)],
                  ["Assignee", ticket.assignedToName ?? "Unassigned"],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2 border-b border-line pb-2">
                  <dt className="caption-2 text-muted">{label}</dt>
                  <dd className="body-5 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {canManage && (
            <Card>
              <CardHeader title="Update ticket" />
              <ManagerTicketActions
                ticketId={ticket.id}
                nextStatuses={nextStatusesFor(ticket.status)}
                managers={managers.map((manager) => ({ uid: manager.uid, name: manager.displayName }))}
                priority={ticket.priority}
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminTicketPage({ params }: PageProps<"/admin/maintenance/[ticketId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Ticket params={params} />
    </Suspense>
  );
}
