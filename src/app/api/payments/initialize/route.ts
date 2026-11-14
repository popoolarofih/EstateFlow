import { apiRoute } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { initializePaymentSchema } from "@/lib/validation/billing";
import { initializeInvoicePayment } from "@/server/services/payments";

/** Starts a provider hosted checkout. Only the authorization URL and reference reach the browser. */
export const POST = apiRoute(
  {
    auth: "member",
    action: "invoice.pay",
    body: initializePaymentSchema,
    rateLimit: ({ uid }) => [RATE_LIMITS.paymentInit, uid ?? "anonymous"],
  },
  async ({ context, actor, body }) => initializeInvoicePayment({ context, actor }, body.invoiceId),
);
