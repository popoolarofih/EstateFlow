import { Receipt } from "@/components/ui/icons";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  BillingRuleDialog,
  GenerateInvoicesButton,
  InvoiceActions,
  ManualInvoiceDialog,
  ReverifyButton,
  RuleActions,
} from "@/components/admin/billing-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceStatusBadge, PaymentStatusBadge } from "@/components/ui/status-badges";
import { Table, Td, Th } from "@/components/ui/table";
import { LinkTabs } from "@/components/ui/tabs";
import { requirePageContext } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { INVOICE_STATUS_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { billingOverview, estateUnits } from "@/server/repositories";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Billing" };

type Tab = "invoices" | "rules" | "payments";

async function Billing({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [context, params] = await Promise.all([requirePageContext("invoice.viewAll"), searchParams]);
  const tab: Tab = params.tab === "rules" || params.tab === "payments" ? params.tab : "invoices";
  const statusParam = typeof params.status === "string" ? params.status : "all";
  const status = (INVOICE_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as InvoiceStatus) : "all";
  const canManage = can(context.member, "invoice.manage");
  const [data, units] = await Promise.all([billingOverview(context, { status }), canManage ? estateUnits(context) : Promise.resolve([])]);
  const tz = context.estate.timezone;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Charges, invoices and verified payments. Only provider confirmed payments mark an invoice as paid."
        actions={
          canManage ? (
            <>
              <ManualInvoiceDialog units={units.map((unit) => ({ id: unit.id, label: unit.label }))} />
              <GenerateInvoicesButton />
            </>
          ) : undefined
        }
      />
      <LinkTabs
        label="Billing sections"
        current={tab}
        tabs={[
          { key: "invoices", label: "Invoices", href: "/admin/billing" },
          { key: "rules", label: "Charges", href: "/admin/billing?tab=rules" },
          ...(can(context.member, "payment.viewAll") ? [{ key: "payments", label: "Payments", href: "/admin/billing?tab=payments" }] : []),
        ]}
      />

      {tab === "invoices" && (
        <>
          <LinkTabs
            label="Filter invoices by status"
            current={status}
            tabs={[{ key: "all", label: "All", href: "/admin/billing" }, ...(["issued", "pending_payment", "partially_paid", "overdue", "paid", "draft", "void"] as const).map((value) => ({ key: value, label: value === "overdue" ? "Defaulters" : INVOICE_STATUS_LABELS[value], href: `/admin/billing?status=${value}` }))]}
          />
          {data.invoices.length === 0 ? (
            <EmptyState icon={<Receipt size={24} />} title="No invoices here" description="Approve a charge, then generate invoices for the current period." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Unit</Th>
                  <Th>Period</Th>
                  <Th>Amount</Th>
                  <Th>Paid</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                  {canManage && (
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <Td className="title-4">{invoice.unitLabel}</Td>
                    <Td>{invoice.periodKey}</Td>
                    <Td className="tabular-nums">{formatNaira(invoice.amountDueKobo)}</Td>
                    <Td className="tabular-nums">{formatNaira(invoice.amountPaidKobo)}</Td>
                    <Td>{formatDate(invoice.dueAt, tz)}</Td>
                    <Td>
                      <InvoiceStatusBadge status={invoice.status} />
                    </Td>
                    {canManage && (
                      <Td>
                        <InvoiceActions invoiceId={invoice.id} unitLabel={invoice.unitLabel} status={invoice.status} />
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}

      {tab === "rules" && (
        <>
          {can(context.member, "billingRule.draft") && (
            <div>
              <BillingRuleDialog />
            </div>
          )}
          {data.rules.length === 0 ? (
            <EmptyState icon={<Receipt size={24} />} title="No charges yet" description="Draft your service charge, security levy or waste charge. Exco approves before anything is billed." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Charge</Th>
                  <Th>Billed</Th>
                  <Th>Amount per unit</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.rules.map((rule) => (
                  <tr key={rule.id}>
                    <Td>
                      <span className="title-4">{rule.name}</span>
                      {rule.description && <span className="block caption-2 text-muted">{rule.description}</span>}
                    </Td>
                    <Td>{rule.frequency === "monthly" ? "Monthly" : "Quarterly"}</Td>
                    <Td className="tabular-nums">{formatNaira(rule.amountKobo)}</Td>
                    <Td>
                      <Badge tone={rule.status === "approved" ? "teal" : rule.status === "draft" ? "gold" : "neutral"}>
                        {rule.status === "approved" ? "Approved" : rule.status === "draft" ? "Awaiting approval" : "Archived"}
                      </Badge>
                    </Td>
                    <Td>
                      <RuleActions
                        ruleId={rule.id}
                        name={rule.name}
                        canApprove={rule.status === "draft" && can(context.member, "billingRule.approve") && rule.createdBy !== context.member.uid}
                        canArchive={rule.status !== "archived" && (can(context.member, "billingRule.draft") || can(context.member, "billingRule.approve"))}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}

      {tab === "payments" && (
        <>
          {data.payments.length === 0 ? (
            <EmptyState icon={<Receipt size={24} />} title="No payments yet" description="Online payments appear here once residents start checkout." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Amount</Th>
                  <Th>Started</Th>
                  <Th>Confirmed</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <Td className="font-mono caption-2">{payment.providerReference}</Td>
                    <Td className="tabular-nums">{formatNaira(payment.amountKobo)}</Td>
                    <Td>{formatDateTime(payment.createdAt, tz)}</Td>
                    <Td>{payment.verifiedAt ? formatDateTime(payment.verifiedAt, tz) : "Not yet"}</Td>
                    <Td>
                      <PaymentStatusBadge status={payment.status} />
                      {payment.failureReason && <span className="mt-1 block caption-2 text-muted">{payment.failureReason}</span>}
                    </Td>
                    <Td>{payment.status === "pending" && can(context.member, "payment.reverify") && <ReverifyButton reference={payment.providerReference} />}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </>
  );
}

export default function BillingPage({ searchParams }: PageProps<"/admin/billing">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Billing searchParams={searchParams} />
    </Suspense>
  );
}
