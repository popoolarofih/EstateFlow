import { apiRoute } from "@/lib/api/handler";
import { adminDb } from "@/lib/firebase/admin";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { verifyPassSchema } from "@/lib/validation/passes";
import { verifyVisitorPass } from "@/server/services/passes";

/** Gate verification. Rate limited per guard and per gate to resist code guessing. */
export const POST = apiRoute(
  {
    auth: "member",
    action: "pass.verify",
    body: verifyPassSchema,
    rateLimit: ({ uid }) => [RATE_LIMITS.passVerifyGuard, uid ?? "anonymous"],
  },
  async ({ context, actor, body }) => {
    await enforceRateLimit(adminDb(), RATE_LIMITS.passVerifyGate, `${context.estate.id}:${body.gateId}`);
    return verifyVisitorPass({ context, actor }, body);
  },
);
