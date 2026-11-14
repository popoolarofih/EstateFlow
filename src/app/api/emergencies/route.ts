import { apiRoute } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createEmergencySchema } from "@/lib/validation/maintenance";
import { raiseEmergency } from "@/server/services/emergencies";

export const POST = apiRoute(
  {
    auth: "member",
    action: "emergency.create",
    body: createEmergencySchema,
    rateLimit: ({ uid }) => [RATE_LIMITS.emergency, uid ?? "anonymous"],
  },
  async ({ context, actor, body }) => raiseEmergency({ context, actor }, body),
);
