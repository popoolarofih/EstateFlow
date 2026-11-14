import { apiRoute } from "@/lib/api/handler";
import { updateEstateSchema } from "@/lib/validation/estates";
import { updateEstate } from "@/server/services/estates";

export const PATCH = apiRoute(
  { auth: "member", action: "estate.settings", body: updateEstateSchema },
  async ({ context, actor, body }) => {
    await updateEstate({ context, actor }, body);
    return { ok: true };
  },
);
