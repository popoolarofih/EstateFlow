import { ArrowLeft, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PrintButton } from "@/components/resident/print-button";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/feedback";
import { requirePageContext } from "@/lib/auth/authorize";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { receiptFor } from "@/server/repositories";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

async function ReceiptView({ params }: { params: Promise<{ paymentId: string }> }) {
  const [{ paymentId }, context] = await Promise.all([params, requirePageContext("invoice.viewOwn")]);
  const receipt = await receiptFor(context, paymentId);
  const rows: [string, string][] = [
    ["Receipt number", receipt.receiptNumber],
    ["Paid by", receipt.payerName],
    ["Unit", receipt.unitLabel],
    ["Billing period", receipt.periodKey],
    ["Payment reference", receipt.paymentId],
    ["Confirmed", formatDateTime(receipt.issuedAt, context.estate.timezone)],
  ];
  return (
    <>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/resident/payments" className="inline-flex min-h-12 items-center gap-2 rounded-lg button-sm text-violet-ink">
          <ArrowLeft size={18} aria-hidden /> Payments
        </Link>
        <div className="flex gap-2">
          <PrintButton />
          <a href={`/api/receipts/${receipt.paymentId}`} className={buttonClasses("primary", "md")} download>
            <DownloadSimple size={20} aria-hidden />
            <span>Download PDF</span>
          </a>
        </div>
      </div>
      <Card className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="caption-1 text-muted">{context.estate.name}</p>
          <h1 className="heading-5 text-ink">Payment receipt</h1>
        </div>
        <div className="rounded-xl bg-canvas p-4">
          <p className="caption-1 text-muted">Amount received</p>
          <p className="heading-4 font-mono tabular-nums text-ink">{formatNaira(receipt.amountKobo)}</p>
        </div>
        <dl className="grid gap-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap justify-between gap-2 border-b border-line pb-3">
              <dt className="caption-2 text-muted">{label}</dt>
              <dd className="body-5 text-ink break-all">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="caption-2 text-muted">Issued after the payment provider confirmed the transaction.</p>
      </Card>
    </>
  );
}

export default function ReceiptPage({ params }: PageProps<"/resident/payments/receipts/[paymentId]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} label="Loading receipt" />}>
      <ReceiptView params={params} />
    </Suspense>
  );
}
