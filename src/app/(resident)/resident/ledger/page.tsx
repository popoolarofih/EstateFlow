import { ArrowDown, ArrowUp, FileText, Notebook } from "@/components/ui/icons";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { LedgerSummaryCards } from "@/components/ui/ledger-summary";
import { List, ListRow } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/authorize";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { ledgerSummary, publishedLedger } from "@/server/repositories";

export const metadata: Metadata = { title: "Estate ledger" };

async function Ledger() {
  const context = await requirePageContext("ledger.viewPublished");
  const [summary, entries] = await Promise.all([ledgerSummary(context), publishedLedger(context)]);
  return (
    <>
      <PageHeader
        title="Estate ledger"
        description="Published income and approved spending for your estate. Entries are never edited after publishing; corrections appear as reversals."
      />
      <LedgerSummaryCards summary={summary} />
      {entries.length === 0 ? (
        <EmptyState icon={<Notebook size={24} />} title="Nothing published yet" description="When Exco publishes income and approved expenses, they will appear here with their evidence." />
      ) : (
        <List label="Published ledger entries">
          {entries.map((entry) => (
            <ListRow
              key={entry.id}
              leading={entry.type === "income" ? <ArrowDown size={20} /> : <ArrowUp size={20} />}
              title={entry.description}
              meta={
                <span className="flex flex-wrap items-center gap-2">
                  {formatDate(entry.transactionDate, context.estate.timezone)} · {entry.category}
                  {entry.vendor && ` · ${entry.vendor}`}
                  {entry.evidencePaths.map((path, index) => (
                    <a key={path} href={`/api/files?path=${encodeURIComponent(path)}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md text-violet-ink underline underline-offset-4">
                      <FileText size={14} aria-hidden /> Evidence {entry.evidencePaths.length > 1 ? index + 1 : ""}
                    </a>
                  ))}
                </span>
              }
              trailing={
                <div className="flex flex-col items-end gap-1">
                  <span className={`body-4 tabular-nums ${entry.type === "income" ? "text-teal-ink" : "text-ink"}`}>
                    {entry.kind === "reversal"
                      ? `(${formatNaira(entry.amountKobo)})`
                      : `${entry.type === "income" ? "+" : "−"}${formatNaira(entry.amountKobo)}`}
                  </span>
                  <Badge tone={entry.kind === "reversal" ? "neutral" : entry.type === "income" ? "teal" : "gold"}>
                    {entry.kind === "reversal" ? "Reversal" : entry.type === "income" ? "Income" : "Expense"}
                  </Badge>
                </div>
              }
            />
          ))}
        </List>
      )}
    </>
  );
}

export default function LedgerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Ledger />
    </Suspense>
  );
}
