import { apiRoute } from "@/lib/api/handler";
import { resolveEmergencySchema } from "@/lib/validation/maintenance";
import { resolveEmergency } from "@/server/services/emergencies";

export const POST = apiRoute(
  { auth: "member", action: "emergency.resolve", body: resolveEmergencySchema },
  async ({ context, actor, params, body }) => {
    await resolveEmergency({ context, actor }, params.id!, body.resolutionNotes);
    return { ok: true };
  },
);
