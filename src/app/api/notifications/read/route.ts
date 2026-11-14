import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { idSchema } from "@/lib/validation/common";

const schema = z.object({ ids: z.array(idSchema).max(100).optional() });

/** Marks the caller's own notifications as read (all unread ones when no ids are given). */
export const POST = apiRoute({ auth: "member", body: schema }, async ({ context, body }) => {
  const db = adminDb();
  const base = db
    .collection(COLLECTIONS.notifications)
    .where("estateId", "==", context.estate.id)
    .where("uid", "==", context.member.uid);
  const snapshot = body.ids?.length
    ? await base.where("__name__", "in", body.ids.slice(0, 30).map((id) => db.collection(COLLECTIONS.notifications).doc(id))).get()
    : await base.where("readAt", "==", null).limit(400).get();
  const batch = db.batch();
  for (const doc of snapshot.docs) batch.update(doc.ref, { readAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { updated: snapshot.size };
});
