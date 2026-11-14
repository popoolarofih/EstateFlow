import { NextResponse, type NextRequest } from "next/server";
import { jsonError, toAppError } from "@/lib/api/handler";
import { paystackWebhookSecret } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";
import { appNotifier } from "@/server/services/context";
import { paymentProvider } from "@/server/services/payments";
import { processPaystackWebhook } from "@/server/services/webhooks";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Paystack webhook. The signature is verified against the raw body; processing is idempotent.
 * 2xx tells Paystack to stop retrying, so transient failures return 5xx on purpose.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = paystackWebhookSecret();
    if (!secret) throw new AppError("not_configured", "Payments are not configured.");
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) throw new AppError("validation_failed", "Payload too large.");
    const result = await processPaystackWebhook({
      db: adminDb(),
      notifier: appNotifier(),
      provider: paymentProvider(),
      rawBody,
      signature: request.headers.get("x-paystack-signature"),
      secret,
    });
    logger.info("paystack webhook handled", { status: result.status });
    return NextResponse.json({ received: true });
  } catch (error) {
    const appError = toAppError(error);
    if (appError.status >= 500) logger.error("paystack webhook failed", { error });
    else logger.warn("paystack webhook rejected", { errorCode: appError.code });
    return jsonError(appError);
  }
}
