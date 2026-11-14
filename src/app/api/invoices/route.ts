import { apiRoute } from "@/lib/api/handler";
import { manualInvoiceSchema } from "@/lib/validation/billing";
import { createManualInvoice } from "@/server/services/billing";

export const POST = apiRoute(
  { auth: "member", action: "invoice.manage", body: manualInvoiceSchema },
  async ({ context, actor, body }) => createManualInvoice({ context, actor }, body),
);
