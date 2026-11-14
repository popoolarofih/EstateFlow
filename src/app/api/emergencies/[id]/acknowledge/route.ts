import { apiRoute } from "@/lib/api/handler";
import { acknowledgeEmergency } from "@/server/services/emergencies";

export const POST = apiRoute({ auth: "member", action: "emergency.acknowledge" }, async ({ context, actor, params }) => {
  await acknowledgeEmergency({ context, actor }, params.id!);
  return { ok: true };
});
