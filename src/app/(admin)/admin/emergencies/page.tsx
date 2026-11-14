import { Siren } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ResolveEmergencyButton } from "@/components/admin/resolve-emergency";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { EmergencyCategoryText, EmergencyStatusBadge } from "@/components/ui/status-badges";
import { Table, Td, Th } from "@/components/ui/table";
import { requirePageContext } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/time";
import { emergencyFeed } from "@/server/repositories";

export const metadata: Metadata = { title: "Emergencies" };

function minutesBetween(start: Date, end: Date | null): string {
  if (!end) return "Not yet";
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  return minutes < 1 ? "Under a minute" : `${minutes} min`;
}

async function Emergencies() {
  const context = await requirePageContext("emergency.viewAll");
  const alerts = await emergencyFeed(context);
  const tz = context.estate.timezone;
  return (
    <>
      <PageHeader title="Emergencies" description="Every alert with its acknowledgement time and resolution. EstateFlow does not replace emergency services." />
      {alerts.length === 0 ? (
        <EmptyState icon={<Siren size={24} />} title="No alerts raised" description="Resident alerts appear here and on every guard device in real time." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Raised</Th>
              <Th>Alert</Th>
              <Th>Acknowledged</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <Td>{formatDateTime(alert.createdAt, tz)}</Td>
                <Td>
                  <span className="title-4">
                    <EmergencyCategoryText alert={alert} /> · {alert.unitLabel}
                  </span>
                  <span className="block caption-2 text-muted">
                    {alert.createdByName}
                    {alert.locationText ? ` · ${alert.locationText}` : ""}
                    {alert.escalationLevel > 0 ? ` · escalated level ${alert.escalationLevel}` : ""}
                  </span>
                  {alert.resolutionNotes && <span className="block caption-2 text-muted">Resolution: {alert.resolutionNotes}</span>}
                </Td>
                <Td>
                  {minutesBetween(alert.createdAt, alert.acknowledgedAt)}
                  {alert.acknowledgedByName && <span className="block caption-2 text-muted">{alert.acknowledgedByName}</span>}
                </Td>
                <Td>
                  <EmergencyStatusBadge alert={alert} />
                </Td>
                <Td>{alert.status !== "resolved" && can(context.member, "emergency.resolve") && <ResolveEmergencyButton alertId={alert.id} unitLabel={alert.unitLabel} />}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export default function EmergenciesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Emergencies />
    </Suspense>
  );
}
