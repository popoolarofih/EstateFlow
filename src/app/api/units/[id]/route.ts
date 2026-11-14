import { apiRoute } from "@/lib/api/handler";
import { unitSchema } from "@/lib/validation/members";
import { updateUnit } from "@/server/services/units";

export const PATCH = apiRoute(
  { auth: "member", action: "units.manage", body: unitSchema },
  async ({ context, actor, params, body }) => {
    await updateUnit({ context, actor }, params.id!, body);
    return { ok: true };
  },
);
