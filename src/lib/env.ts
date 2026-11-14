import "server-only";
import { AppError } from "@/lib/errors";
import { siteUrl } from "@/lib/site-url";

/** Server side configuration. Secrets are read lazily so a missing optional secret only fails its feature. */

export function passCodeSecret(): string {
  const secret = process.env.PASS_CODE_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError("not_configured", "Visitor passes are not configured on this server.");
  }
  return secret;
}

export function paystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new AppError("not_configured", "Online payments are not configured for this estate yet.");
  return key;
}

export function paystackWebhookSecret(): string | null {
  return process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || null;
}

export function appBaseUrl(): string {
  return siteUrl();
}

export function appCheckEnforced(): boolean {
  return process.env.APP_CHECK_ENFORCE === "true";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && !process.env.FIRESTORE_EMULATOR_HOST;
}
