import { Wrench } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Suspense } from "react";
import { NewTicket } from "@/components/resident/new-ticket";
import { EmptyState, ListSkeleton } from "@/components/ui/feedback";
import { List, ListRow } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { PriorityBadge, TicketStatusBadge } from "@/components/ui/status-badges";
import { requirePageContext } from "@/lib/auth/authorize";
import { formatDate } from "@/lib/time";
import { unitTickets } from "@/server/repositories";

export const metadata: Metadata = { title: "Services" };

async function Services() {
  const context = await requirePageContext("maintenance.viewOwn");
  const tickets = await unitTickets(context);
  return (
    <>
      <PageHeader title="Services" description="Report maintenance issues and follow them until they are fixed." actions={<NewTicket />} />
      {tickets.length === 0 ? (
        <EmptyState icon={<Wrench size={24} />} title="No requests yet" description="Report a leak, a power fault or anything else that needs the facility team. Add photos to speed things up." />
      ) : (
        <List label="Maintenance requests">
          {tickets.map((ticket) => (
            <ListRow
              key={ticket.id}
              href={`/resident/services/${ticket.id}`}
              leading={<Wrench size={20} />}
              title={ticket.title}
              meta={`Reported ${formatDate(ticket.createdAt, context.estate.timezone)}${ticket.assignedToName ? ` · with ${ticket.assignedToName}` : ""}`}
              trailing={
                <>
                  {(ticket.priority === "urgent" || ticket.priority === "high") && <PriorityBadge priority={ticket.priority} />}
                  <TicketStatusBadge status={ticket.status} />
                </>
              }
            />
          ))}
        </List>
      )}
    </>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} label="Loading requests" />}>
      <Services />
    </Suspense>
  );
}
