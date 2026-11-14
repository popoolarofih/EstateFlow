import { apiRoute } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createPassSchema } from "@/lib/validation/passes";
import { createVisitorPass } from "@/server/services/passes";

export const POST = apiRoute(
  {
    auth: "member",
    action: "pass.create",
    body: createPassSchema,
    rateLimit: ({ uid }) => [RATE_LIMITS.passCreate, uid ?? "anonymous"],
  },
  async ({ context, actor, body }) => createVisitorPass({ context, actor }, body),
);
