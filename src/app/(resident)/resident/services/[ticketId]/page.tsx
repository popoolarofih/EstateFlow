import { ArrowLeft } from "@/components/ui/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/feedback";
import { PriorityBadge, TicketStatusBadge } from "@/components/ui/status-badges";
import { CommentForm, OwnerTicketActions } from "@/components/ui/ticket-actions";
import { TicketPhotos, TicketTimeline } from "@/components/ui/ticket-timeline";
import { requirePageContext } from "@/lib/auth/authorize";
import { formatDateTime } from "@/lib/time";
import { ticketWithEvents } from "@/server/repositories";

export const metadata: Metadata = { title: "Maintenance request" };

async function Ticket({ params }: { params: Promise<{ ticketId: string }> }) {
  const [{ ticketId }, context] = await Promise.all([params, requirePageContext("maintenance.viewOwn")]);
  const { ticket, events } = await ticketWithEvents(context, ticketId);
  const tz = context.estate.timezone;
  return (
    <>
      <Link href="/resident/services" className="inline-flex min-h-12 items-center gap-2 self-start rounded-lg button-sm text-violet-ink">
        <ArrowLeft size={18} aria-hidden /> All requests
      </Link>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
        <h1 className="heading-5 text-ink">{ticket.title}</h1>
        <p className="body-3 whitespace-pre-line text-ink">{ticket.description}</p>
        <TicketPhotos paths={ticket.photoPaths} />
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="caption-2 text-muted">Reported</dt>
            <dd className="body-5">{formatDateTime(ticket.createdAt, tz)}</dd>
          </div>
          <div>
            <dt className="caption-2 text-muted">Target response</dt>
            <dd className="body-5">{formatDateTime(ticket.targetSlaAt, tz)}</dd>
          </div>
          {ticket.assignedToName && (
            <div>
              <dt className="caption-2 text-muted">Handled by</dt>
              <dd className="body-5">{ticket.assignedToName}</dd>
            </div>
          )}
          {ticket.resolutionNotes && (
            <div className="sm:col-span-2">
              <dt className="caption-2 text-muted">Resolution</dt>
              <dd className="body-5 whitespace-pre-line">{ticket.resolutionNotes}</dd>
            </div>
          )}
        </dl>
        <OwnerTicketActions ticketId={ticket.id} status={ticket.status} />
      </Card>
      <Card>
        <CardHeader title="Updates" />
        <div className="flex flex-col gap-6">
          <TicketTimeline events={events} timezone={tz} />
          {ticket.status !== "closed" && <CommentForm ticketId={ticket.id} />}
        </div>
      </Card>
    </>
  );
}

export default function TicketPage({ params }: PageProps<"/resident/services/[ticketId]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} label="Loading request" />}>
      <Ticket params={params} />
    </Suspense>
  );
}
