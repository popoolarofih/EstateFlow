import { ArrowRight, Notebook, Receipt, UserPlus, Users, Wrench } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmergencyPanel } from "@/components/resident/emergency-panel";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { List, ListRow } from "@/components/ui/list";
import { PassStatusBadge, TicketStatusBadge } from "@/components/ui/status-badges";
import { requirePageContext } from "@/lib/auth/authorize";
import { PASS_TYPE_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import { formatDateTime, formatRelative, zonedParts } from "@/lib/time";
import { residentDashboard } from "@/server/repositories";

export const metadata: Metadata = { title: "Home" };

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

async function ResidentHome() {
  const context = await requirePageContext("pass.create");
  const data = await residentDashboard(context);
  const now = new Date();
  const hour = Math.floor(zonedParts(now, context.estate.timezone).minutesOfDay / 60);
  const firstName = (context.profile?.displayName ?? context.member.displayName).split(" ")[0];

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="caption-1 text-muted">{context.estate.name}</p>
        <h1 className="heading-5 md:heading-4 text-ink">
          {greeting(hour)}, {firstName}
        </h1>
      </div>

      <section className="flex flex-col gap-4 rounded-3xl bg-navy p-6 text-white">
        <div className="flex flex-col gap-1">
          <h2 className="heading-6">Expecting someone?</h2>
          <p className="body-6 text-white/70">Create a pass in seconds and share the code with your guest.</p>
        </div>
        <LinkButton href="/resident/visitors?new=1" size="lg" icon={<UserPlus size={24} aria-hidden />}>
          Invite a guest
        </LinkButton>
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="caption-1 text-muted">Outstanding balance</p>
            <p className="heading-4 font-mono tabular-nums text-ink">{formatNaira(data.outstandingKobo)}</p>
            <p className="caption-2 text-muted">
              {data.openInvoiceCount === 0
                ? "You are all paid up."
                : `${data.openInvoiceCount} open invoice${data.openInvoiceCount === 1 ? "" : "s"}${data.overdueCount ? `, ${data.overdueCount} overdue` : ""}`}
            </p>
          </div>
          {data.outstandingKobo > 0 ? (
            <LinkButton href="/resident/payments" variant="dark" icon={<Receipt size={20} aria-hidden />}>
              View and pay
            </LinkButton>
          ) : (
            <LinkButton href="/resident/ledger" variant="secondary" icon={<Notebook size={20} aria-hidden />}>
              Estate ledger
            </LinkButton>
          )}
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="heading-6 text-ink">Recent passes</h2>
          <Link href="/resident/visitors" className="inline-flex items-center gap-1 rounded-md button-sm text-violet-ink">
            All passes <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        {data.recentPasses.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="No passes yet"
            description="Passes you create for guests, deliveries and domestic staff will appear here."
          />
        ) : (
          <List label="Recent passes">
            {data.recentPasses.map((pass) => (
              <ListRow
                key={pass.id}
                leading={<Users size={20} />}
                title={pass.guestName}
                meta={`${PASS_TYPE_LABELS[pass.passType]} · until ${formatDateTime(pass.validUntil, context.estate.timezone)}`}
                trailing={<PassStatusBadge status={pass.status} />}
              />
            ))}
          </List>
        )}
      </section>

      {data.openTickets.length > 0 && (
        <Card>
          <CardHeader
            title="Open maintenance requests"
            action={
              <Link href="/resident/services" className="rounded-md button-sm text-violet-ink">
                View all
              </Link>
            }
          />
          <List label="Open maintenance requests">
            {data.openTickets.map((ticket) => (
              <ListRow
                key={ticket.id}
                href={`/resident/services/${ticket.id}`}
                leading={<Wrench size={20} />}
                title={ticket.title}
                meta={`Updated ${formatRelative(ticket.updatedAt, now)}`}
                trailing={<TicketStatusBadge status={ticket.status} />}
              />
            ))}
          </List>
        </Card>
      )}

      <EmergencyPanel
        contacts={context.estate.emergencyContacts}
        timezone={context.estate.timezone}
        activeAlert={
          data.activeAlert
            ? {
                id: data.activeAlert.id,
                status: data.activeAlert.status,
                category: data.activeAlert.category,
                acknowledgedByName: data.activeAlert.acknowledgedByName,
                acknowledgedAt: data.activeAlert.acknowledgedAt,
                createdAt: data.activeAlert.createdAt,
              }
            : null
        }
      />
    </>
  );
}

export default function ResidentHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResidentHome />
    </Suspense>
  );
}
