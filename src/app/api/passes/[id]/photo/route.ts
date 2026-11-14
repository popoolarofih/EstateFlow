import { FieldValue } from "firebase-admin/firestore";
import { apiRoute } from "@/lib/api/handler";
import { assertSameEstate } from "@/lib/auth/authorize";
import { auditInTransaction } from "@/lib/audit/audit";
import { conflict, notFound } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { filesFrom, validateUpload } from "@/lib/uploads";
import { deleteFiles, storeFile } from "@/server/services/files";
import type { VisitorPass } from "@/types/domain";

/** Attaches an identification photo to a domestic staff pass (resident of the same unit only). */
export const POST = apiRoute(
  { auth: "member", action: "pass.create", multipart: true, rateLimit: ({ uid }) => [RATE_LIMITS.upload, uid ?? "anonymous"] },
  async ({ context, actor, params, request }) => {
    const db = adminDb();
    const ref = db.collection(COLLECTIONS.visitorPasses).doc(params.id!);
    const pass = assertSameEstate(fromDoc<VisitorPass>(await ref.get()), context);
    if (pass.unitId !== context.member.unitId) throw notFound();
    if (pass.passType !== "staff") throw conflict("Photos can only be added to domestic staff passes.");
    if (pass.status !== "active") throw conflict("This pass is no longer active.");
    const [file] = filesFrom(await request.formData(), "photo", 1);
    if (!file) throw conflict("Choose a photo to upload.");
    const path = await storeFile(context.estate.id, "passes", pass.id, await validateUpload(file, "image"));
    const batch = db.batch();
    batch.update(ref, { photoPath: path, photoUpdatedAt: FieldValue.serverTimestamp() });
    auditInTransaction(db, batch, actor, {
      estateId: pass.estateId,
      action: "pass.photo_added",
      entityType: "visitorPass",
      entityId: pass.id,
    });
    await batch.commit();
    if (pass.photoPath) await deleteFiles([pass.photoPath]);
    return { ok: true };
  },
);
