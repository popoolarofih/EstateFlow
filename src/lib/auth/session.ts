import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { AppError } from "@/lib/errors";
import { adminAuth } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";

/**
 * Server sessions use Firebase session cookies: secure, HTTP only, SameSite=Lax. The cookie
 * is named `__session` because Firebase Hosting only forwards that cookie name.
 */
export const SESSION_COOKIE = "__session";
const SESSION_MS = 5 * 24 * 60 * 60 * 1000;
/** Only mint a session from a fresh sign in, which limits stolen ID token replay. */
const MAX_AUTH_AGE_SECONDS = 5 * 60;

export interface SessionUser {
  uid: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  platformAdmin: boolean;
}

export async function createSession(idToken: string): Promise<{ cookie: string; maxAgeSeconds: number; user: SessionUser }> {
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken, true);
  } catch {
    throw new AppError("unauthenticated", "Your sign in could not be verified. Please sign in again.");
  }
  if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_SECONDS) {
    throw new AppError("unauthenticated", "Please sign in again to continue.");
  }
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MS });
  return {
    cookie,
    maxAgeSeconds: SESSION_MS / 1000,
    user: {
      uid: decoded.uid,
      email: decoded.email ?? null,
      phone: decoded.phone_number ?? null,
      emailVerified: decoded.email_verified ?? false,
      platformAdmin: decoded.platformAdmin === true,
    },
  };
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Verifies the session cookie (including revocation) once per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Session data is request time only; nothing derived from it may enter a prerendered shell.
  await connection();
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      phone: decoded.phone_number ?? null,
      emailVerified: decoded.email_verified ?? false,
      platformAdmin: decoded.platformAdmin === true,
    };
  } catch (error) {
    logger.debug("session cookie rejected", { error });
    return null;
  }
});

/** Revokes refresh tokens so every session for the user ends (logout, disablement, role change). */
export async function revokeUserSessions(uid: string): Promise<void> {
  await adminAuth().revokeRefreshTokens(uid);
}
