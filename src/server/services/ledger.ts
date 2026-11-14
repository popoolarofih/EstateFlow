import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { z } from "zod";
import { assertSameEstate } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { auditInTransaction } from "@/lib/audit/audit";
import { AppError, conflict, forbidden } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import {
  buildPostings,
  canApprove,
  canDiscard,
  canPublish,
  canReverse,
  isBalanced,
  requiredApprovalsFor,
  reversePostings,
  statusAfterApproval,
} from "@/lib/ledger/ledger";
import { memberUidsWithRoles } from "@/lib/notifications/notify";
import { validateUpload } from "@/lib/uploads";
import type { ledgerDraftSchema } from "@/lib/validation/ledger";
import type { LedgerEntry } from "@/types/domain";
import { appNotifier, type ServiceContext } from "./context";
import { deleteFiles, storeFile } from "./files";

type NewEntry = Omit<LedgerEntry, "id" | "createdAt"> & { createdAt: FieldValue };

export async function createLedgerDraft(
  { context, actor }: ServiceContext,
  input: z.output<typeof ledgerDraftSchema>,
  evidence: File[],
): Promise<{ id: string }> {
  if (!can(context.member, "ledger.draft")) throw forbidden();
  if (input.type === "expense" && evidence.length === 0) {
    throw new AppError("validation_failed", "Attach the invoice, receipt or other evidence for this expense.", {
      fieldErrors: { evidence: ["Evidence is required for expenses."] },
    });
  }
  const db = adminDb();
  const { estate } = context;
  const ref = db.collection(COLLECTIONS.ledgerEntries).doc();
  const uploads = await Promise.all(evidence.map((file) => validateUpload(file, "evidence")));
  const paths: string[] = [];
  try {
    for (const upload of uploads) paths.push(await storeFile(estate.id, "ledger", ref.id, upload));
    const postings = buildPostings({ type: input.type, category: input.category, amountKobo: input.amountKobo, source: "manual" });
    const entry: NewEntry = {
      estateId: estate.id,
      type: input.type,
      kind: "original",
      category: input.category,
      vendor: input.vendor || null,
      description: input.description,
      amountKobo: input.amountKobo,
      transactionDate: new Date(`${input.transactionDate}T12:00:00Z`),
      status: "draft",
      postings,
      evidencePaths: paths,
      source: "manual",
      paymentId: null,
      reversesEntryId: null,
      approvals: [],
      requiredApprovals:
        input.type === "expense" ? requiredApprovalsFor(input.amountKobo, estate.settings.expenseDualApprovalThresholdKobo) : 1,
      createdBy: context.member.uid,
      createdByName: actor.name,
      approvedBy: null,
      publishedAt: null,
      publishedBy: null,
      createdAt: FieldValue.serverTimestamp(),
    };
    const batch = db.batch();
    batch.create(ref, entry);
    auditInTransaction(db, batch, actor, {
      estateId: estate.id,
      action: "ledger.drafted",
      entityType: "ledgerEntry",
      entityId: ref.id,
      after: { type: input.type, amountKobo: input.amountKobo, category: input.category },
    });
    await batch.commit();
  } catch (error) {
    await deleteFiles(paths);
    throw error;
  }
  const approvers = await memberUidsWithRoles(db, estate.id, ["exco"]);
  await appNotifier().send(approvers, {
    estateId: estate.id,
    type: "ledger.awaiting_approval",
    title: "Ledger entry awaiting approval",
    body: input.description,
    link: "/admin/ledger",
  });
  return { id: ref.id };
}

export async function approveLedgerEntry({ context, actor }: ServiceContext, entryId: string): Promise<LedgerEntry["status"]> {
  if (!can(context.member, "ledger.approve")) throw forbidden("You need ledger approval rights.");
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.ledgerEntries).doc(entryId);
  return db.runTransaction(async (tx) => {
    const entry = assertSameEstate(fromDoc<LedgerEntry>(await tx.get(ref)), context);
    const decision = canApprove(entry, context.member.uid);
    if (!decision.ok) throw conflict(decision.message);
    const status = statusAfterApproval(entry);
    tx.update(ref, {
      approvals: FieldValue.arrayUnion({ uid: context.member.uid, name: actor.name, at: new Date() }),
      status,
      approvedBy: status === "approved" ? context.member.uid : null,
    });
    auditInTransaction(db, tx, actor, {
      estateId: entry.estateId,
      action: "ledger.approved",
      entityType: "ledgerEntry",
      entityId: entryId,
      before: { status: entry.status, approvals: entry.approvals.length },
      after: { status, approvals: entry.approvals.length + 1 },
    });
    return status;
  });
}

export async function publishLedgerEntry({ context, actor }: ServiceContext, entryId: string): Promise<void> {
  if (!can(context.member, "ledger.publish")) throw forbidden("You need ledger publishing rights.");
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.ledgerEntries).doc(entryId);
  await db.runTransaction(async (tx) => {
    const entry = assertSameEstate(fromDoc<LedgerEntry>(await tx.get(ref)), context);
    const decision = canPublish(entry);
    if (!decision.ok) throw conflict(decision.message);
    if (!isBalanced(entry.postings)) throw new AppError("internal", "This entry does not balance and cannot be published.");
    tx.update(ref, { status: "published", publishedAt: FieldValue.serverTimestamp(), publishedBy: context.member.uid });
    auditInTransaction(db, tx, actor, {
      estateId: entry.estateId,
      action: "ledger.published",
      entityType: "ledgerEntry",
      entityId: entryId,
      before: { status: entry.status },
      after: { status: "published", amountKobo: entry.amountKobo },
    });
  });
}

/** Published entries are immutable; corrections are new reversal entries that go through approval. */
export async function reverseLedgerEntry(
  { context, actor }: ServiceContext,
  entryId: string,
  reason: string,
): Promise<{ id: string }> {
  if (!can(context.member, "ledger.draft")) throw forbidden();
  const db = adminDb();
  const originalRef = db.collection(COLLECTIONS.ledgerEntries).doc(entryId);
  const reversalRef = db.collection(COLLECTIONS.ledgerEntries).doc(`rev_${entryId}`);
  await db.runTransaction(async (tx) => {
    const original = assertSameEstate(fromDoc<LedgerEntry>(await tx.get(originalRef)), context);
    const decision = canReverse(original);
    if (!decision.ok) throw conflict(decision.message);
    const existing = await tx.get(reversalRef);
    if (existing.exists) throw conflict("A reversal for this entry already exists.");
    const reversal: NewEntry = {
      estateId: original.estateId,
      type: original.type,
      kind: "reversal",
      category: original.category,
      vendor: original.vendor,
      description: `Reversal: ${reason}`,
      amountKobo: original.amountKobo,
      transactionDate: new Date(),
      status: "draft",
      postings: reversePostings(original.postings),
      evidencePaths: [],
      source: "manual",
      paymentId: original.paymentId,
      reversesEntryId: original.id,
      approvals: [],
      requiredApprovals: original.requiredApprovals,
      createdBy: context.member.uid,
      createdByName: actor.name,
      approvedBy: null,
      publishedAt: null,
      publishedBy: null,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.create(reversalRef, reversal);
    auditInTransaction(db, tx, actor, {
      estateId: original.estateId,
      action: "ledger.reversal_drafted",
      entityType: "ledgerEntry",
      entityId: reversalRef.id,
      after: { reversesEntryId: original.id, reason },
    });
  });
  return { id: reversalRef.id };
}

export async function discardLedgerDraft({ context, actor }: ServiceContext, entryId: string): Promise<void> {
  if (!can(context.member, "ledger.draft")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.ledgerEntries).doc(entryId);
  const paths = await db.runTransaction(async (tx) => {
    const entry = assertSameEstate(fromDoc<LedgerEntry>(await tx.get(ref)), context);
    const decision = canDiscard(entry);
    if (!decision.ok) throw conflict(decision.message);
    if (entry.approvals.length > 0) throw conflict("This draft has approvals and can no longer be discarded.");
    tx.delete(ref);
    auditInTransaction(db, tx, actor, {
      estateId: entry.estateId,
      action: "ledger.draft_discarded",
      entityType: "ledgerEntry",
      entityId: entryId,
      before: { type: entry.type, amountKobo: entry.amountKobo, description: entry.description },
    });
    return entry.evidencePaths;
  });
  await deleteFiles(paths);
}
