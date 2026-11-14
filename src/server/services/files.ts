import "server-only";
import { assertSameEstate, type ActiveContext } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { forbidden, notFound } from "@/lib/errors";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { newFileName, type ValidatedUpload } from "@/lib/uploads";
import type { LedgerEntry, MaintenanceTicket, VisitorPass } from "@/types/domain";

/**
 * Private file storage. Paths are always built on the server under `estates/{estateId}/...`;
 * reads go through `authorizeFileRead`, which re-checks the owning record.
 */
export type FileArea = "tickets" | "ledger" | "passes";

export async function storeFile(estateId: string, area: FileArea, ownerId: string, upload: ValidatedUpload): Promise<string> {
  const path = `estates/${estateId}/${area}/${ownerId}/${newFileName(upload.extension)}`;
  await adminStorage()
    .bucket()
    .file(path)
    .save(upload.bytes, {
      resumable: false,
      contentType: upload.contentType,
      metadata: { cacheControl: "private, max-age=0, no-store" },
    });
  return path;
}

export async function deleteFiles(paths: readonly string[]): Promise<void> {
  await Promise.allSettled(paths.map((path) => adminStorage().bucket().file(path).delete({ ignoreNotFound: true })));
}

const PATH_PATTERN = /^estates\/([A-Za-z0-9_-]+)\/(tickets|ledger|passes)\/([A-Za-z0-9_-]+)\/[A-Za-z0-9_.-]+$/;

export async function authorizeFileRead(context: ActiveContext, path: string): Promise<void> {
  const match = PATH_PATTERN.exec(path);
  if (!match) throw notFound();
  const [, estateId, area, ownerId] = match as unknown as [string, string, FileArea, string];
  if (estateId !== context.estate.id) throw notFound();
  const db = adminDb();
  const { member } = context;

  if (area === "tickets") {
    const ticket = assertSameEstate(
      fromDoc<MaintenanceTicket>(await db.collection(COLLECTIONS.maintenanceTickets).doc(ownerId).get()),
      context,
    );
    const owner = ticket.unitId === member.unitId && can(member, "maintenance.viewOwn");
    if (!owner && !can(member, "maintenance.viewAll")) throw forbidden();
    if (!ticket.photoPaths.includes(path)) throw notFound();
    return;
  }
  if (area === "ledger") {
    const entry = assertSameEstate(
      fromDoc<LedgerEntry>(await db.collection(COLLECTIONS.ledgerEntries).doc(ownerId).get()),
      context,
    );
    const visible = can(member, "ledger.viewAll") || (entry.status === "published" && can(member, "ledger.viewPublished"));
    if (!visible) throw forbidden();
    if (!entry.evidencePaths.includes(path)) throw notFound();
    return;
  }
  const pass = assertSameEstate(
    fromDoc<VisitorPass>(await db.collection(COLLECTIONS.visitorPasses).doc(ownerId).get()),
    context,
  );
  const visible = pass.unitId === member.unitId || can(member, "pass.viewAll") || can(member, "pass.verify");
  if (!visible) throw forbidden();
  if (pass.photoPath !== path) throw notFound();
}

export async function readFile(path: string): Promise<{ bytes: Buffer; contentType: string }> {
  const file = adminStorage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw notFound();
  const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
  return { bytes, contentType: metadata.contentType ?? "application/octet-stream" };
}
