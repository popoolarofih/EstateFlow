import { apiRoute } from "@/lib/api/handler";
import { billingRuleSchema } from "@/lib/validation/billing";
import { createBillingRule } from "@/server/services/billing";

export const POST = apiRoute(
  { auth: "member", action: "billingRule.draft", body: billingRuleSchema },
  async ({ context, actor, body }) => createBillingRule({ context, actor }, body),
);
