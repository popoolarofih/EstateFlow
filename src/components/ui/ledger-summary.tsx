import type { LedgerSummary } from "@/lib/ledger/ledger";
import { formatNaira } from "@/lib/money";
import { StatCard } from "./card";

export function LedgerSummaryCards({ summary }: { summary: LedgerSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Income received" value={formatNaira(summary.incomeKobo)} tone="teal" />
      <StatCard label="Approved spending" value={formatNaira(summary.expenseKobo)} tone="gold" />
      <StatCard label="Balance" value={formatNaira(summary.balanceKobo)} tone={summary.balanceKobo < 0 ? "alert" : "violet"} />
    </div>
  );
}
