import { apiRoute } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { verifyPaymentSchema } from "@/lib/validation/billing";
import { verifyPaymentWithProvider } from "@/server/services/payments";

/** Asks the provider for the transaction status. Used after checkout and for missed webhooks. */
export const POST = apiRoute(
  {
    auth: "member",
    action: ["invoice.pay", "payment.reverify"],
    body: verifyPaymentSchema,
    rateLimit: ({ uid }) => [RATE_LIMITS.paymentInit, uid ?? "anonymous"],
  },
  async ({ context, actor, body }) => verifyPaymentWithProvider({ context, actor }, body.reference),
);
