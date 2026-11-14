import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack signs webhooks with HMAC SHA512 over the raw request body, keyed with the secret
 * key, and sends the hex digest in `x-paystack-signature`. Always verify against the raw body
 * bytes, never against re-serialised JSON.
 */
export function computePaystackSignature(rawBody: string, secret: string): string {
  return createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = Buffer.from(computePaystackSignature(rawBody, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function hashPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
