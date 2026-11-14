import { FileText, Notebook } from "@/components/ui/icons";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LedgerEntryDialog, LedgerRowActions } from "@/components/admin/ledger-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { LedgerSummaryCards } from "@/components/ui/ledger-summary";
import { PageHeader } from "@/components/ui/page-header";
import { LedgerStatusBadge } from "@/components/ui/status-badges";
import { Table, Td, Th } from "@/components/ui/table";
import { requirePageContext } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { ledgerForStaff, ledgerSummary } from "@/server/repositories";

export const metadata: Metadata = { title: "Ledger" };

async function Ledger() {
  const context = await requirePageContext("ledger.viewAll");
  const [entries, summary] = await Promise.all([ledgerForStaff(context), ledgerSummary(context)]);
  const reversed = new Set(entries.filter((entry) => entry.reversesEntryId).map((entry) => entry.reversesEntryId));
  const uid = context.member.uid;
  const tz = context.estate.timezone;

  return (
    <>
      <PageHeader
        title="Ledger"
        description="Drafts are recorded by managers, approved and published by Exco. Published entries are immutable."
        actions={can(context.member, "ledger.draft") ? <LedgerEntryDialog dualApprovalThresholdKobo={context.estate.settings.expenseDualApprovalThresholdKobo} /> : undefined}
      />
      <LedgerSummaryCards summary={summary} />
      {entries.length === 0 ? (
        <EmptyState icon={<Notebook size={24} />} title="No entries yet" description="Record expenses with their evidence. Verified dues payments are added automatically." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Entry</Th>
              <Th>Amount</Th>
              <Th>Approvals</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <Td>{formatDate(entry.transactionDate, tz)}</Td>
                <Td>
                  <span className="flex flex-wrap items-center gap-2 title-4">
                    {entry.description}
                    {entry.kind === "reversal" && <Badge tone="neutral">Reversal</Badge>}
                    {entry.source === "payment" && <Badge tone="violet">Verified payment</Badge>}
                  </span>
                  <span className="block caption-2 text-muted">
                    {entry.type === "income" ? "Income" : "Expense"} · {entry.category}
                    {entry.vendor ? ` · ${entry.vendor}` : ""} · by {entry.createdByName}
                  </span>
                  {entry.evidencePaths.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-2">
                      {entry.evidencePaths.map((path, index) => (
                        <a key={path} href={`/api/files?path=${encodeURIComponent(path)}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 caption-1 text-violet-ink underline underline-offset-4">
                          <FileText size={14} aria-hidden /> Evidence {index + 1}
                        </a>
                      ))}
                    </span>
                  )}
                </Td>
                <Td className="tabular-nums">{formatNaira(entry.amountKobo)}</Td>
                <Td>
                  {entry.source === "payment" ? "Provider verified" : `${entry.approvals.length} of ${entry.requiredApprovals}`}
                  {entry.approvals.length > 0 && <span className="block caption-2 text-muted">{entry.approvals.map((approval) => approval.name).join(", ")}</span>}
                </Td>
                <Td>
                  <LedgerStatusBadge status={entry.status} />
                </Td>
                <Td>
                  <LedgerRowActions
                    entryId={entry.id}
                    description={`${entry.description} · ${formatNaira(entry.amountKobo)}`}
                    canApprove={entry.status === "draft" && can(context.member, "ledger.approve") && entry.createdBy !== uid && !entry.approvals.some((approval) => approval.uid === uid)}
                    canPublish={entry.status === "approved" && can(context.member, "ledger.publish")}
                    canReverse={entry.status === "published" && entry.kind === "original" && !reversed.has(entry.id) && can(context.member, "ledger.draft")}
                    canDiscard={entry.status === "draft" && entry.approvals.length === 0 && can(context.member, "ledger.draft")}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export default function AdminLedgerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Ledger />
    </Suspense>
  );
}
