import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";

const schema = z.object({ token: z.string().min(20).max(4096) });

/** Registers a web push token for the signed in user (one document per token). */
export const POST = apiRoute({ auth: "user", body: schema }, async ({ user, body, meta }) => {
  const id = createHash("sha256").update(body.token).digest("hex").slice(0, 40);
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(user.uid)
    .collection(COLLECTIONS.pushTokens)
    .doc(id)
    .set({ token: body.token, userAgent: meta.userAgent?.slice(0, 200) ?? null, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});
