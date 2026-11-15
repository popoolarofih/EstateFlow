import { Scroll } from "@/components/ui/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { requirePageContext } from "@/lib/auth/authorize";
import { formatDateTime } from "@/lib/time";
import { auditTrail } from "@/server/repositories";

export const metadata: Metadata = { title: "Audit log" };

function describe(value: Record<string, unknown> | null): string {
  if (!value) return "";
  return Object.entries(value)
    .slice(0, 6)
    .map(([key, item]) => `${key}: ${typeof item === "object" ? JSON.stringify(item) : String(item)}`)
    .join(" · ");
}

async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [context, params] = await Promise.all([requirePageContext("audit.view"), searchParams]);
  const before = typeof params.before === "string" && !Number.isNaN(Date.parse(params.before)) ? new Date(params.before) : undefined;
  const { logs, hasMore } = await auditTrail(context, before);
  const tz = context.estate.timezone;
  return (
    <>
      <PageHeader title="Audit log" description="Who did what and when, for every sensitive action. Records are append only." />
      {logs.length === 0 ? (
        <EmptyState icon={<Scroll size={24} />} title="No audit events yet" description="Role changes, invoices, payments, pass revocations, emergencies and ledger approvals are recorded here." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <Td className="whitespace-nowrap">{formatDateTime(log.createdAt, tz)}</Td>
                <Td>{log.actorName}</Td>
                <Td className="font-mono caption-2">{log.action}</Td>
                <Td className="caption-2 text-muted">
                  {log.before && <span className="block">Before: {describe(log.before)}</span>}
                  {log.after && <span className="block">After: {describe(log.after)}</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {hasMore && logs.at(-1) && (
        <Link href={`/admin/audit?before=${encodeURIComponent(logs.at(-1)!.createdAt.toISOString())}`} className="self-start rounded-md button-sm text-violet-ink underline underline-offset-4">
          Older events
        </Link>
      )}
    </>
  );
}

export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}
