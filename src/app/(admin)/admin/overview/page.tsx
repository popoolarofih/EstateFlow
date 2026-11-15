import { DoorOpen, Wrench } from "@/components/ui/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExportPanel } from "@/components/admin/export-panel";
import { LiveEmergencies } from "@/components/guard/live-emergencies";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { List, ListRow } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { PriorityBadge, TicketStatusBadge } from "@/components/ui/status-badges";
import { Badge } from "@/components/ui/badge";
import { requirePageContext } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { formatNaira } from "@/lib/money";
import { formatRelative, formatTime } from "@/lib/time";
import { adminOverview } from "@/server/repositories";

export const metadata: Metadata = { title: "Overview" };

async function Overview() {
  const context = await requirePageContext("reports.view");
  const data = await adminOverview(context);
  const now = new Date();
  const tz = context.estate.timezone;
  const collectionRate = data.periodDueKobo > 0 ? Math.round((data.periodPaidKobo / data.periodDueKobo) * 1000) / 10 : 0;
  const gateNames = new Map(context.estate.gates.map((gate) => [gate.id, gate.name]));

  return (
    <>
      <PageHeader title="Overview" description={`${context.estate.name} · live operations and collections for ${data.periodKey}.`} />
      {can(context.member, "emergency.viewAll") && (
        <LiveEmergencies
          tone="light"
          estateId={context.estate.id}
          timezone={tz}
          initial={data.activeAlerts.map(({ id, unitLabel, category, locationText, status, createdAt, acknowledgedByName, callbackPhone }) => ({
            id,
            unitLabel,
            category,
            locationText,
            status,
            createdAt,
            acknowledgedByName,
            callbackPhone,
          }))}
        />
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Occupancy" value={`${data.occupiedUnits} / ${data.units}`} detail={`${data.activeResidents} active residents`} tone="violet" />
        <StatCard label="Active passes" value={String(data.activePasses)} tone="teal" />
        <StatCard label="Outstanding invoices" value={String(data.outstandingInvoices)} detail={`${data.overdueInvoices} overdue`} tone={data.overdueInvoices > 0 ? "gold" : "neutral"} />
        <StatCard label="Open tickets" value={String(data.openTickets)} tone={data.openTickets > 0 ? "gold" : "neutral"} />
      </div>

      <Card>
        <CardHeader title={`Collections for ${data.periodKey}`} description={`${data.periodInvoices} invoices issued this period.`} />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="heading-5 tabular-nums">{formatNaira(data.periodPaidKobo)}</p>
            <p className="body-6 text-muted">of {formatNaira(data.periodDueKobo)} billed · {collectionRate}% collected</p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`${collectionRate} percent collected`}>
            <div className="h-full origin-left rounded-full bg-teal" style={{ transform: `scaleX(${Math.min(1, collectionRate / 100)})` }} />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent gate events" />
          {data.recentGateEvents.length === 0 ? (
            <EmptyState icon={<DoorOpen size={24} />} title="No gate events yet" description="Entries, exits and denied attempts will appear here as guards verify passes." />
          ) : (
            <List label="Recent gate events">
              {data.recentGateEvents.map((event) => (
                <ListRow
                  key={event.id}
                  title={`${event.eventType === "exit" ? "Exit" : event.result === "allow" ? "Entry" : "Denied"}${event.guestName ? ` · ${event.guestName}` : ""}`}
                  meta={`${formatTime(event.occurredAt, tz)} · ${gateNames.get(event.gateId) ?? event.gateId}${event.unitLabel ? ` · Unit ${event.unitLabel}` : ""}`}
                  trailing={<Badge tone={event.result === "allow" ? "teal" : "alert"}>{event.result === "allow" ? "Allowed" : "Denied"}</Badge>}
                />
              ))}
            </List>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Open maintenance"
            action={
              <Link href="/admin/maintenance" className="rounded-md button-sm text-violet-ink">
                View all
              </Link>
            }
          />
          {data.recentTickets.length === 0 ? (
            <EmptyState icon={<Wrench size={24} />} title="No open tickets" description="New maintenance requests from residents will show up here." />
          ) : (
            <List label="Open maintenance tickets">
              {data.recentTickets.map((ticket) => (
                <ListRow
                  key={ticket.id}
                  href={`/admin/maintenance/${ticket.id}`}
                  title={ticket.title}
                  meta={`${ticket.unitLabel} · ${formatRelative(ticket.createdAt, now)}`}
                  trailing={
                    <>
                      <PriorityBadge priority={ticket.priority} />
                      <TicketStatusBadge status={ticket.status} />
                    </>
                  }
                />
              ))}
            </List>
          )}
        </Card>
      </div>

      {can(context.member, "reports.export") && (
        <Card>
          <CardHeader title="Exports" description="Download records as CSV for your accountant or AGM reports." />
          <ExportPanel />
        </Card>
      )}
    </>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}
