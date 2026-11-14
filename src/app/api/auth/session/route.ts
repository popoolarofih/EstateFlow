import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { getActiveMemberships } from "@/lib/auth/authorize";
import { roleHome } from "@/lib/auth/permissions";
import {
  createSession,
  getSessionUser,
  revokeUserSessions,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { RATE_LIMITS } from "@/lib/rate-limit";

const bodySchema = z.object({
  idToken: z.string().min(100).max(4096),
  next: z.string().max(200).optional(),
});

function safeNext(next: string | undefined): string | null {
  // Only allow local paths to prevent open redirects.
  return next && /^\/(?!\/)[A-Za-z0-9/_\-?=&.]*$/.test(next) ? next : null;
}

/** Exchanges a fresh Firebase ID token for an HTTP only session cookie. */
export const POST = apiRoute(
  { auth: "public", body: bodySchema, rateLimit: ({ ip }) => [RATE_LIMITS.session, ip] },
  async ({ body }) => {
    const { cookie, maxAgeSeconds, user } = await createSession(body.idToken);
    const record = await adminAuth().getUser(user.uid);
    const userRef = adminDb().collection(COLLECTIONS.users).doc(user.uid);
    const existing = await userRef.get();
    await userRef.set(
      {
        displayName: existing.get("displayName") || record.displayName || user.email?.split("@")[0] || "Resident",
        email: user.email,
        phone: user.phone,
        photoURL: record.photoURL ?? null,
        disabled: record.disabled,
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp(), activeEstateId: null }),
      },
      { merge: true },
    );

    const memberships = await getActiveMemberships(user.uid);
    const preferred = existing.get("activeEstateId") as string | undefined;
    const active = memberships.find((member) => member.estateId === preferred) ?? memberships[0];
    const redirectTo =
      safeNext(body.next) ?? (active ? roleHome(active.role) : user.platformAdmin ? "/platform" : "/no-access");

    const response = NextResponse.json({ redirectTo });
    response.cookies.set(SESSION_COOKIE, cookie, sessionCookieOptions(maxAgeSeconds));
    return response;
  },
);

/** Signs out: revokes refresh tokens (ending other sessions too) and clears the cookie. */
export const DELETE = apiRoute({ auth: "public" }, async () => {
  const user = await getSessionUser();
  if (user) await revokeUserSessions(user.uid);
  const response = NextResponse.json({ redirectTo: "/sign-in" });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return response;
});
