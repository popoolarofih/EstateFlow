import { apiRoute } from "@/lib/api/handler";
import { issueInvoice } from "@/server/services/billing";

export const POST = apiRoute({ auth: "member", action: "invoice.manage" }, async ({ context, actor, params }) => {
  await issueInvoice({ context, actor }, params.id!);
  return { ok: true };
});
