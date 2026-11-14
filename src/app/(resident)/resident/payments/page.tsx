import { DownloadSimple, Notebook, Receipt } from "@/components/ui/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PayButton } from "@/components/resident/pay-button";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ListSkeleton, Notice } from "@/components/ui/feedback";
import { List, ListRow } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceStatusBadge, PaymentStatusBadge } from "@/components/ui/status-badges";
import { requirePageContext } from "@/lib/auth/authorize";
import { isPayable, outstandingKobo } from "@/lib/billing/invoices";
import { formatNaira } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { unitInvoices } from "@/server/repositories";

export const metadata: Metadata = { title: "Payments" };

async function Payments() {
  const context = await requirePageContext("invoice.viewOwn");
  const { invoices, payments, receipts } = await unitInvoices(context);
  const tz = context.estate.timezone;
  const open = invoices.filter((invoice) => isPayable(invoice.status));
  const totalOutstanding = open.reduce((sum, invoice) => sum + outstandingKobo(invoice), 0);
  const receiptIds = new Set(receipts.map((receipt) => receipt.paymentId));

  return (
    <>
      <PageHeader
        title="Payments"
        description="Your estate dues, payment history and receipts. Payments are confirmed with the provider before they count."
        actions={
          <LinkButton href="/resident/ledger" variant="secondary" icon={<Notebook size={20} aria-hidden />}>
            Estate ledger
          </LinkButton>
        }
      />

      <Card>
        <p className="caption-1 text-muted">Total outstanding</p>
        <p className="heading-4 tabular-nums text-ink">{formatNaira(totalOutstanding)}</p>
        {!context.estate.paymentConfig.enabled && totalOutstanding > 0 && (
          <div className="mt-4">
            <Notice tone="info">Online payment is not enabled for your estate yet. Pay through your estate office for now.</Notice>
          </div>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="heading-6 text-ink">Invoices</h2>
        {invoices.length === 0 ? (
          <EmptyState icon={<Receipt size={24} />} title="No invoices yet" description="When your estate issues dues for your unit, they will appear here." />
        ) : (
          <List label="Invoices">
            {invoices.map((invoice) => {
              const outstanding = outstandingKobo(invoice);
              return (
                <ListRow
                  key={invoice.id}
                  leading={<Receipt size={20} />}
                  title={`${invoice.periodKey} · ${formatNaira(invoice.amountDueKobo)}`}
                  meta={
                    <>
                      {invoice.lineItems.map((item) => item.description).join(", ")} · due {formatDate(invoice.dueAt, tz)}
                      {invoice.amountPaidKobo > 0 && invoice.status !== "paid" && ` · ${formatNaira(outstanding)} left`}
                    </>
                  }
                  trailing={
                    <>
                      <InvoiceStatusBadge status={invoice.status} />
                      {isPayable(invoice.status) && outstanding > 0 && context.estate.paymentConfig.enabled && (
                        <PayButton invoiceId={invoice.id} label={`Pay ${formatNaira(outstanding)}`} />
                      )}
                    </>
                  }
                />
              );
            })}
          </List>
        )}
      </section>

      <Card>
        <CardHeader title="Payment history" description="Receipts are issued only after the payment provider confirms the money was received." />
        {payments.length === 0 ? (
          <p className="body-6 text-muted">No payments yet.</p>
        ) : (
          <List label="Payment history">
            {payments.map((payment) => (
              <ListRow
                key={payment.id}
                title={formatNaira(payment.amountKobo)}
                meta={`${formatDateTime(payment.verifiedAt ?? payment.createdAt, tz)} · ref ${payment.providerReference}`}
                trailing={
                  <>
                    <PaymentStatusBadge status={payment.status} />
                    {receiptIds.has(payment.id) && (
                      <Link
                        href={`/resident/payments/receipts/${payment.id}`}
                        className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 button-sm text-violet-ink hover:bg-violet-soft"
                      >
                        <DownloadSimple size={16} aria-hidden /> Receipt
                      </Link>
                    )}
                  </>
                }
              />
            ))}
          </List>
        )}
      </Card>
    </>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} label="Loading payments" />}>
      <Payments />
    </Suspense>
  );
}
