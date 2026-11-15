import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { AppError } from "@/lib/errors";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { consumeWindow, type WindowState } from "@/lib/rate-limit-window";

/**
 * Firestore backed fixed window rate limiter (no Redis in the MVP). One document per key;
 * keys are hashed so identifiers like IP addresses are not stored in clear text.
 */
export interface RateLimitRule {
  name: string;
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  passCreate: { name: "pass-create", limit: 20, windowMs: 60 * 60_000 },
  passVerifyGuard: { name: "pass-verify-guard", limit: 30, windowMs: 60_000 },
  passVerifyGate: { name: "pass-verify-gate", limit: 120, windowMs: 60_000 },
  emergency: { name: "emergency", limit: 3, windowMs: 10 * 60_000 },
  paymentInit: { name: "payment-init", limit: 10, windowMs: 10 * 60_000 },
  session: { name: "session", limit: 20, windowMs: 10 * 60_000 },
  inviteAccept: { name: "invite-accept", limit: 10, windowMs: 10 * 60_000 },
  pilotRequest: { name: "pilot-request", limit: 5, windowMs: 60 * 60_000 },
  upload: { name: "upload", limit: 30, windowMs: 60 * 60_000 },
  clientError: { name: "client-error", limit: 20, windowMs: 10 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export async function enforceRateLimit(db: Firestore, rule: RateLimitRule, subject: string, now = Date.now()) {
  const id = createHash("sha256").update(`${rule.name}:${subject}`).digest("hex").slice(0, 40);
  const ref = db.collection(COLLECTIONS.rateLimits).doc(id);
  const decision = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const state = snapshot.exists ? (snapshot.data() as WindowState) : null;
    const result = consumeWindow(state, now, rule.limit, rule.windowMs);
    if (result.allowed) {
      tx.set(ref, { ...result.next, rule: rule.name, expiresAt: new Date(result.next.windowStart + rule.windowMs) });
    }
    return result;
  });
  if (!decision.allowed) {
    throw new AppError("rate_limited", "Too many attempts. Please wait a moment and try again.", {
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }
}
