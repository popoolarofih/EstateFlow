import "server-only";
import { audit } from "@/lib/audit/audit";
import { can } from "@/lib/auth/permissions";
import { toCsv } from "@/lib/csv";
import { AppError, forbidden } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromQuery } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { koboToNairaInput } from "@/lib/money";
import { addDays } from "@/lib/time";
import type { GateEvent, Invoice, LedgerEntry, Payment } from "@/types/domain";
import type { ServiceContext } from "./context";

export const EXPORT_KINDS = ["invoices", "payments", "expenses", "gate-events"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

const MAX_ROWS = 5000;
const MAX_RANGE_DAYS = 400;

function parseRange(from: string | null, to: string | null): { start: Date; end: Date } {
  const end = to ? new Date(`${to}T23:59:59.999+01:00`) : new Date();
  const start = from ? new Date(`${from}T00:00:00+01:00`) : addDays(end, -90);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new AppError("validation_failed", "Choose a valid date range.");
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw new AppError("validation_failed", `Exports cover at most ${MAX_RANGE_DAYS} days.`);
  }
  return { start, end };
}

const naira = (kobo: number) => koboToNairaInput(kobo);

export async function buildExport(
  { context, actor }: ServiceContext,
  kind: ExportKind,
  range: { from: string | null; to: string | null },
): Promise<{ csv: string; filename: string }> {
  if (!can(context.member, "reports.export")) throw forbidden();
  const { start, end } = parseRange(range.from, range.to);
  const db = adminDb();
  const base = (collection: string) => db.collection(collection).where("estateId", "==", context.estate.id);
  let csv: string;

  switch (kind) {
    case "invoices": {
      const rows = fromQuery<Invoice>(
        await base(COLLECTIONS.invoices).where("createdAt", ">=", start).where("createdAt", "<=", end).orderBy("createdAt").limit(MAX_ROWS).get(),
      );
      csv = toCsv(rows, [
        { header: "Invoice", value: (row) => row.id },
        { header: "Unit", value: (row) => row.unitLabel },
        { header: "Period", value: (row) => row.periodKey },
        { header: "Status", value: (row) => row.status },
        { header: "Amount due (NGN)", value: (row) => naira(row.amountDueKobo) },
        { header: "Amount paid (NGN)", value: (row) => naira(row.amountPaidKobo) },
        { header: "Due date", value: (row) => row.dueAt },
        { header: "Created", value: (row) => row.createdAt },
      ]);
      break;
    }
    case "payments": {
      const rows = fromQuery<Payment>(
        await base(COLLECTIONS.payments).where("createdAt", ">=", start).where("createdAt", "<=", end).orderBy("createdAt").limit(MAX_ROWS).get(),
      );
      csv = toCsv(rows, [
        { header: "Reference", value: (row) => row.providerReference },
        { header: "Invoice", value: (row) => row.invoiceId },
        { header: "Unit", value: (row) => row.unitId },
        { header: "Amount (NGN)", value: (row) => naira(row.amountKobo) },
        { header: "Status", value: (row) => row.status },
        { header: "Verified at", value: (row) => row.verifiedAt },
        { header: "Created", value: (row) => row.createdAt },
      ]);
      break;
    }
    case "expenses": {
      const rows = fromQuery<LedgerEntry>(
        await base(COLLECTIONS.ledgerEntries)
          .where("type", "==", "expense")
          .where("transactionDate", ">=", start)
          .where("transactionDate", "<=", end)
          .orderBy("transactionDate")
          .limit(MAX_ROWS)
          .get(),
      );
      csv = toCsv(rows, [
        { header: "Entry", value: (row) => row.id },
        { header: "Kind", value: (row) => row.kind },
        { header: "Date", value: (row) => row.transactionDate },
        { header: "Category", value: (row) => row.category },
        { header: "Vendor", value: (row) => row.vendor },
        { header: "Description", value: (row) => row.description },
        { header: "Amount (NGN)", value: (row) => naira(row.amountKobo) },
        { header: "Status", value: (row) => row.status },
        { header: "Approvals", value: (row) => row.approvals.map((approval) => approval.name).join("; ") },
        { header: "Evidence files", value: (row) => row.evidencePaths.length },
      ]);
      break;
    }
    case "gate-events": {
      const rows = fromQuery<GateEvent>(
        await base(COLLECTIONS.gateEvents).where("occurredAt", ">=", start).where("occurredAt", "<=", end).orderBy("occurredAt").limit(MAX_ROWS).get(),
      );
      const gateNames = new Map(context.estate.gates.map((gate) => [gate.id, gate.name]));
      csv = toCsv(rows, [
        { header: "Time", value: (row) => row.occurredAt },
        { header: "Gate", value: (row) => gateNames.get(row.gateId) ?? row.gateId },
        { header: "Event", value: (row) => row.eventType },
        { header: "Result", value: (row) => row.result },
        { header: "Reason", value: (row) => row.reason },
        { header: "Unit", value: (row) => row.unitLabel },
        { header: "Guest", value: (row) => row.guestName },
        { header: "Guard", value: (row) => row.guardName },
        { header: "Method", value: (row) => row.method },
      ]);
      break;
    }
  }
  await audit(db, actor, {
    estateId: context.estate.id,
    action: "report.exported",
    entityType: "export",
    entityId: kind,
    after: { from: start.toISOString(), to: end.toISOString() },
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return { csv, filename: `${context.estate.slug}_${kind}_${stamp}.csv` };
}
