import "server-only";
import { AggregateField, type Query } from "firebase-admin/firestore";
import { assertSameEstate, type ActiveContext } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { outstandingKobo, periodKeyFor } from "@/lib/billing/invoices";
import { forbidden, notFound } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc, fromQuery } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import type { LedgerSummary } from "@/lib/ledger/ledger";
import { OPEN_TICKET_STATUSES } from "@/lib/maintenance/workflow";
import type {
  AppNotification,
  AuditLog,
  BillingRule,
  EmergencyAlert,
  EstateMember,
  GateEvent,
  Invite,
  Invoice,
  InvoiceStatus,
  LedgerEntry,
  MaintenanceTicket,
  Payment,
  Receipt,
  TicketEvent,
  TicketStatus,
  Unit,
  VisitorPass,
} from "@/types/domain";

/**
 * Read models for Server Components. Every query is constrained to the active estate and
 * re-checks the caller's permission; no function accepts an estate id from the client.
 */

const db = () => adminDb();
const scoped = (collection: string, context: ActiveContext) =>
  db().collection(collection).where("estateId", "==", context.estate.id);

function requireCan(context: ActiveContext, ...actions: Parameters<typeof can>[1][]) {
  if (!actions.some((action) => can(context.member, action))) throw forbidden();
}

function ownUnit(context: ActiveContext): string {
  if (!context.member.unitId) throw forbidden("Your membership is not linked to a unit.");
  return context.member.unitId;
}

const PAYABLE_STATUSES: InvoiceStatus[] = ["issued", "pending_payment", "partially_paid", "overdue"];

/* ----------------------------------------------------------------- residents */

export async function residentDashboard(context: ActiveContext) {
  const unitId = ownUnit(context);
  const [invoices, passes, tickets, alerts] = await Promise.all([
    scoped(COLLECTIONS.invoices, context).where("unitId", "==", unitId).where("status", "in", PAYABLE_STATUSES).limit(50).get(),
    scoped(COLLECTIONS.visitorPasses, context).where("unitId", "==", unitId).orderBy("createdAt", "desc").limit(5).get(),
    scoped(COLLECTIONS.maintenanceTickets, context)
      .where("unitId", "==", unitId)
      .where("status", "in", [...OPEN_TICKET_STATUSES])
      .orderBy("createdAt", "desc")
      .limit(5)
      .get(),
    scoped(COLLECTIONS.emergencyAlerts, context)
      .where("createdByUid", "==", context.member.uid)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get(),
  ]);
  const openInvoices = fromQuery<Invoice>(invoices);
  const latestAlert = fromQuery<EmergencyAlert>(alerts)[0] ?? null;
  return {
    outstandingKobo: openInvoices.reduce((total, invoice) => total + outstandingKobo(invoice), 0),
    openInvoiceCount: openInvoices.length,
    overdueCount: openInvoices.filter((invoice) => invoice.status === "overdue").length,
    recentPasses: fromQuery<VisitorPass>(passes),
    openTickets: fromQuery<MaintenanceTicket>(tickets),
    activeAlert: latestAlert && latestAlert.status !== "resolved" ? latestAlert : null,
  };
}

export async function unitPasses(context: ActiveContext): Promise<VisitorPass[]> {
  requireCan(context, "pass.create");
  const snapshot = await scoped(COLLECTIONS.visitorPasses, context)
    .where("unitId", "==", ownUnit(context))
    .orderBy("createdAt", "desc")
    .limit(60)
    .get();
  return fromQuery<VisitorPass>(snapshot);
}

export async function unitInvoices(context: ActiveContext) {
  requireCan(context, "invoice.viewOwn");
  const unitId = ownUnit(context);
  const [invoices, payments, receipts] = await Promise.all([
    scoped(COLLECTIONS.invoices, context).where("unitId", "==", unitId).orderBy("createdAt", "desc").limit(36).get(),
    scoped(COLLECTIONS.payments, context).where("unitId", "==", unitId).orderBy("createdAt", "desc").limit(30).get(),
    scoped(COLLECTIONS.receipts, context).where("unitId", "==", unitId).orderBy("issuedAt", "desc").limit(30).get(),
  ]);
  return {
    invoices: fromQuery<Invoice>(invoices).filter((invoice) => invoice.status !== "draft"),
    payments: fromQuery<Payment>(payments),
    receipts: fromQuery<Receipt>(receipts),
  };
}

export async function receiptFor(context: ActiveContext, paymentId: string): Promise<Receipt> {
  const receipt = assertSameEstate(
    fromDoc<Receipt>(await db().collection(COLLECTIONS.receipts).doc(paymentId).get()),
    context,
  );
  const isOwner = receipt.unitId === context.member.unitId && can(context.member, "invoice.viewOwn");
  if (!isOwner && !can(context.member, "invoice.viewAll")) throw notFound();
  return receipt;
}

export async function paymentStatusFor(context: ActiveContext, reference: string): Promise<Payment> {
  const payment = assertSameEstate(fromDoc<Payment>(await db().collection(COLLECTIONS.payments).doc(reference).get()), context);
  if (payment.payerUid !== context.member.uid && !can(context.member, "payment.viewAll")) throw notFound();
  return payment;
}

async function sumAmount(query: Query): Promise<number> {
  const snapshot = await query.aggregate({ total: AggregateField.sum("amountKobo") }).get();
  return Number(snapshot.data().total ?? 0);
}

export async function ledgerSummary(context: ActiveContext): Promise<LedgerSummary> {
  requireCan(context, "ledger.viewPublished", "ledger.viewAll");
  const published = scoped(COLLECTIONS.ledgerEntries, context).where("status", "==", "published");
  const [income, incomeReversed, expense, expenseReversed] = await Promise.all([
    sumAmount(published.where("type", "==", "income").where("kind", "==", "original")),
    sumAmount(published.where("type", "==", "income").where("kind", "==", "reversal")),
    sumAmount(published.where("type", "==", "expense").where("kind", "==", "original")),
    sumAmount(published.where("type", "==", "expense").where("kind", "==", "reversal")),
  ]);
  const incomeKobo = income - incomeReversed;
  const expenseKobo = expense - expenseReversed;
  return { incomeKobo, expenseKobo, balanceKobo: incomeKobo - expenseKobo };
}

export async function publishedLedger(context: ActiveContext): Promise<LedgerEntry[]> {
  requireCan(context, "ledger.viewPublished");
  const snapshot = await scoped(COLLECTIONS.ledgerEntries, context)
    .where("status", "==", "published")
    .orderBy("publishedAt", "desc")
    .limit(100)
    .get();
  return fromQuery<LedgerEntry>(snapshot);
}

export async function unitTickets(context: ActiveContext): Promise<MaintenanceTicket[]> {
  requireCan(context, "maintenance.viewOwn");
  const snapshot = await scoped(COLLECTIONS.maintenanceTickets, context)
    .where("unitId", "==", ownUnit(context))
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return fromQuery<MaintenanceTicket>(snapshot);
}

export async function ticketWithEvents(context: ActiveContext, ticketId: string) {
  const ref = db().collection(COLLECTIONS.maintenanceTickets).doc(ticketId);
  const ticket = assertSameEstate(fromDoc<MaintenanceTicket>(await ref.get()), context);
  const isOwner = ticket.unitId === context.member.unitId && can(context.member, "maintenance.viewOwn");
  if (!isOwner && !can(context.member, "maintenance.viewAll")) throw notFound();
  const events = await ref.collection(COLLECTIONS.ticketEvents).orderBy("createdAt", "asc").limit(200).get();
  return { ticket, events: fromQuery<TicketEvent>(events) };
}

/* -------------------------------------------------------------------- guards */

export async function gateActivity(context: ActiveContext, gateIds: string[]) {
  requireCan(context, "gate.viewEvents");
  const since = new Date(Date.now() - 24 * 3_600_000);
  let query = scoped(COLLECTIONS.gateEvents, context).where("occurredAt", ">", since);
  if (context.member.role === "guard") {
    const allowed = gateIds.filter((gateId) => context.member.gateIds.includes(gateId));
    if (allowed.length === 0) return { events: [], inside: [] };
    query = query.where("gateId", "in", allowed.slice(0, 10));
  }
  const events = fromQuery<GateEvent>(await query.orderBy("occurredAt", "desc").limit(300).get());
  const exited = new Set(events.filter((event) => event.eventType === "exit").map((event) => event.entryEventId));
  const inside = events.filter((event) => event.eventType === "entry" && !exited.has(event.id));
  return { events: events.slice(0, 100), inside };
}

/* --------------------------------------------------------------------- admin */

export async function adminOverview(context: ActiveContext) {
  requireCan(context, "reports.view");
  const periodKey = periodKeyFor(new Date(), "monthly", context.estate.timezone);
  const units = scoped(COLLECTIONS.units, context);
  const invoices = scoped(COLLECTIONS.invoices, context);
  const [unitCount, occupied, residents, activePasses, period, outstanding, overdue, openTickets, gateEvents, alerts, tickets] =
    await Promise.all([
      units.count().get(),
      units.where("occupancyStatus", "==", "occupied").count().get(),
      scoped(COLLECTIONS.estateMembers, context).where("role", "==", "resident").where("status", "==", "active").count().get(),
      scoped(COLLECTIONS.visitorPasses, context).where("status", "==", "active").count().get(),
      invoices
        .where("periodKey", "==", periodKey)
        .aggregate({ due: AggregateField.sum("amountDueKobo"), paid: AggregateField.sum("amountPaidKobo"), count: AggregateField.count() })
        .get(),
      invoices.where("status", "in", PAYABLE_STATUSES).count().get(),
      invoices.where("status", "==", "overdue").count().get(),
      scoped(COLLECTIONS.maintenanceTickets, context).where("status", "in", [...OPEN_TICKET_STATUSES]).count().get(),
      scoped(COLLECTIONS.gateEvents, context).orderBy("occurredAt", "desc").limit(8).get(),
      scoped(COLLECTIONS.emergencyAlerts, context).where("status", "in", ["open", "acknowledged"]).limit(10).get(),
      scoped(COLLECTIONS.maintenanceTickets, context)
        .where("status", "in", [...OPEN_TICKET_STATUSES])
        .orderBy("createdAt", "desc")
        .limit(5)
        .get(),
    ]);
  const periodData = period.data();
  return {
    periodKey,
    units: unitCount.data().count,
    occupiedUnits: occupied.data().count,
    activeResidents: residents.data().count,
    activePasses: activePasses.data().count,
    periodDueKobo: Number(periodData.due ?? 0),
    periodPaidKobo: Number(periodData.paid ?? 0),
    periodInvoices: Number(periodData.count ?? 0),
    outstandingInvoices: outstanding.data().count,
    overdueInvoices: overdue.data().count,
    openTickets: openTickets.data().count,
    recentGateEvents: fromQuery<GateEvent>(gateEvents),
    activeAlerts: fromQuery<EmergencyAlert>(alerts),
    recentTickets: fromQuery<MaintenanceTicket>(tickets),
  };
}

export async function unitsDirectory(context: ActiveContext) {
  requireCan(context, "units.manage", "members.manage");
  const [units, members, invites] = await Promise.all([
    scoped(COLLECTIONS.units, context).limit(2000).get(),
    scoped(COLLECTIONS.estateMembers, context).limit(3000).get(),
    scoped(COLLECTIONS.invites, context).where("status", "==", "pending").orderBy("createdAt", "desc").limit(200).get(),
  ]);
  const sortedUnits = fromQuery<Unit>(units).sort(
    (a, b) => (a.block ?? "").localeCompare(b.block ?? "") || a.label.localeCompare(b.label, undefined, { numeric: true }),
  );
  return {
    units: sortedUnits,
    members: fromQuery<EstateMember>(members).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    invites: fromQuery<Invite>(invites),
  };
}

export async function estateUnits(context: ActiveContext): Promise<Unit[]> {
  requireCan(context, "invoice.manage", "units.manage");
  const units = fromQuery<Unit>(await scoped(COLLECTIONS.units, context).limit(2000).get());
  return units.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export async function billingOverview(context: ActiveContext, filter: { status?: InvoiceStatus | "all" }) {
  requireCan(context, "invoice.viewAll");
  let invoiceQuery = scoped(COLLECTIONS.invoices, context);
  if (filter.status && filter.status !== "all") invoiceQuery = invoiceQuery.where("status", "==", filter.status);
  const [rules, invoices, payments] = await Promise.all([
    scoped(COLLECTIONS.billingRules, context).orderBy("createdAt", "desc").limit(50).get(),
    invoiceQuery.orderBy("createdAt", "desc").limit(150).get(),
    can(context.member, "payment.viewAll")
      ? scoped(COLLECTIONS.payments, context).orderBy("createdAt", "desc").limit(100).get()
      : null,
  ]);
  return {
    rules: fromQuery<BillingRule>(rules),
    invoices: fromQuery<Invoice>(invoices),
    payments: payments ? fromQuery<Payment>(payments) : [],
  };
}

export async function ledgerForStaff(context: ActiveContext): Promise<LedgerEntry[]> {
  requireCan(context, "ledger.viewAll");
  const snapshot = await scoped(COLLECTIONS.ledgerEntries, context).orderBy("createdAt", "desc").limit(150).get();
  return fromQuery<LedgerEntry>(snapshot);
}

export async function estateTickets(context: ActiveContext, status?: TicketStatus | "open" | "all") {
  requireCan(context, "maintenance.viewAll");
  let query = scoped(COLLECTIONS.maintenanceTickets, context);
  if (status === "open" || !status) query = query.where("status", "in", [...OPEN_TICKET_STATUSES]);
  else if (status !== "all") query = query.where("status", "==", status);
  return fromQuery<MaintenanceTicket>(await query.orderBy("createdAt", "desc").limit(150).get());
}

export async function estateManagers(context: ActiveContext): Promise<EstateMember[]> {
  const snapshot = await scoped(COLLECTIONS.estateMembers, context)
    .where("role", "==", "manager")
    .where("status", "==", "active")
    .limit(50)
    .get();
  return fromQuery<EstateMember>(snapshot);
}

export async function emergencyFeed(context: ActiveContext): Promise<EmergencyAlert[]> {
  requireCan(context, "emergency.viewAll");
  const snapshot = await scoped(COLLECTIONS.emergencyAlerts, context).orderBy("createdAt", "desc").limit(50).get();
  return fromQuery<EmergencyAlert>(snapshot);
}

export async function auditTrail(context: ActiveContext, before?: Date) {
  requireCan(context, "audit.view");
  let query = scoped(COLLECTIONS.auditLogs, context).orderBy("createdAt", "desc");
  if (before) query = query.startAfter(before);
  const logs = fromQuery<AuditLog>(await query.limit(51).get());
  return { logs: logs.slice(0, 50), hasMore: logs.length > 50 };
}

export async function myNotifications(context: ActiveContext): Promise<AppNotification[]> {
  const snapshot = await scoped(COLLECTIONS.notifications, context)
    .where("uid", "==", context.member.uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return fromQuery<AppNotification>(snapshot);
}

export async function unreadNotificationCount(context: ActiveContext): Promise<number> {
  const snapshot = await scoped(COLLECTIONS.notifications, context)
    .where("uid", "==", context.member.uid)
    .where("readAt", "==", null)
    .count()
    .get();
  return snapshot.data().count;
}
