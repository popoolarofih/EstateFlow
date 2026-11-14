import { apiRoute } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { pilotRequestSchema } from "@/lib/validation/estates";
import { recordPilotRequest } from "@/server/services/estates";

/** Landing page conversion: a request for a pilot walkthrough. */
export const POST = apiRoute(
  { auth: "public", body: pilotRequestSchema, rateLimit: ({ ip }) => [RATE_LIMITS.pilotRequest, ip] },
  async ({ body, meta }) => {
    await recordPilotRequest(body, meta);
    return { ok: true };
  },
);
