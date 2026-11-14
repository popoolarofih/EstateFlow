import { apiRoute } from "@/lib/api/handler";
import { voidInvoiceSchema } from "@/lib/validation/billing";
import { voidInvoice } from "@/server/services/billing";

export const POST = apiRoute(
  { auth: "member", action: "invoice.manage", body: voidInvoiceSchema },
  async ({ context, actor, params, body }) => {
    await voidInvoice({ context, actor }, params.id!, body.reason);
    return { ok: true };
  },
);
