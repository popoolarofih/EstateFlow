import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { AppError } from "@/lib/errors";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { logger } from "@/lib/logger";
import type { Notifier } from "@/lib/notifications/notify";
import { paystackWebhookSchema } from "@/lib/payments/paystack";
import type { PaymentProvider } from "@/lib/payments/provider";
import { hashPayload, verifyPaystackSignature } from "@/lib/payments/signature";
import { reconcilePayment, type ReconcileOutcome } from "./payments";

const STALE_PROCESSING_MS = 5 * 60_000;

export type WebhookResult =
  | { status: "processed"; outcome: ReconcileOutcome }
  | { status: "duplicate" }
  | { status: "ignored"; event: string };

/**
 * Paystack webhook pipeline: signature over the raw body, event de-duplication by payload hash,
 * independent confirmation through the provider Verify API, then idempotent reconciliation.
 * Throws on transient failures so the provider retries.
 */
export async function processPaystackWebhook(input: {
  db: Firestore;
  notifier: Notifier;
  provider: PaymentProvider;
  rawBody: string;
  signature: string | null;
  secret: string;
}): Promise<WebhookResult> {
  const { db, rawBody } = input;
  if (!verifyPaystackSignature(rawBody, input.signature, input.secret)) {
    throw new AppError("unauthenticated", "Invalid webhook signature.");
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new AppError("validation_failed", "Webhook body is not valid JSON.");
  }
  const parsed = paystackWebhookSchema.safeParse(json);
  if (!parsed.success) throw new AppError("validation_failed", "Webhook payload was not understood.");
  const event = parsed.data;
  if (event.event !== "charge.success") {
    logger.info("paystack webhook ignored", { event: event.event });
    return { status: "ignored", event: event.event };
  }

  const payloadHash = hashPayload(rawBody);
  const eventRef = db.collection(COLLECTIONS.webhookEvents).doc(`paystack_${payloadHash}`);
  const claimed = await db.runTransaction(async (tx) => {
    const existing = await tx.get(eventRef);
    if (existing.exists) {
      const status = existing.get("status");
      const updatedAt = (existing.get("updatedAt") as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? 0;
      if (status === "processed") return false;
      if (status === "processing" && Date.now() - updatedAt < STALE_PROCESSING_MS) return false;
    }
    tx.set(eventRef, {
      provider: "paystack",
      event: event.event,
      reference: event.data.reference,
      status: "processing",
      updatedAt: FieldValue.serverTimestamp(),
      receivedAt: existing.exists ? existing.get("receivedAt") : FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!claimed) return { status: "duplicate" };

  try {
    // Never trust the webhook body alone: confirm amount, currency and status with the provider.
    const transaction = await input.provider.verify(event.data.reference);
    const outcome = await reconcilePayment(db, input.notifier, transaction, { source: "webhook", payloadHash });
    await eventRef.update({ status: "processed", outcome, updatedAt: FieldValue.serverTimestamp() });
    return { status: "processed", outcome };
  } catch (error) {
    await eventRef.update({ status: "failed", updatedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
    throw error;
  }
}
