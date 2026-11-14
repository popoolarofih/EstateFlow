import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Cryptographically secure, uniformly distributed six digit code. */
export function createSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Keyed hash of a pass code, bound to the estate so the same code in two estates never
 * collides and a code can never be looked up globally.
 */
export function hashPassCode(estateId: string, code: string, secret: string): string {
  if (secret.length < 32) throw new Error("PASS_CODE_HMAC_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(`${estateId}:${code}`).digest("hex");
}

/** High entropy opaque bearer token for the QR payload. */
export function createQrToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** Document id of the per estate code lock used for O(1), estate scoped code lookup. */
export function passCodeLockId(estateId: string, codeHash: string): string {
  return `${estateId}_${codeHash}`;
}
