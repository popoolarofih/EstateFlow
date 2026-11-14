import { apiRoute } from "@/lib/api/handler";
import { approveBillingRule } from "@/server/services/billing";

export const POST = apiRoute({ auth: "member", action: "billingRule.approve" }, async ({ context, actor, params }) => {
  await approveBillingRule({ context, actor }, params.id!);
  return { ok: true };
});
