import { apiRoute } from "@/lib/api/handler";
import { archiveBillingRule } from "@/server/services/billing";

export const POST = apiRoute(
  { auth: "member", action: ["billingRule.draft", "billingRule.approve"] },
  async ({ context, actor, params }) => {
    await archiveBillingRule({ context, actor }, params.id!);
    return { ok: true };
  },
);
