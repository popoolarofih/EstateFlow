import { apiRoute } from "@/lib/api/handler";
import { unitSchema } from "@/lib/validation/members";
import { createUnit } from "@/server/services/units";

export const POST = apiRoute(
  { auth: "member", action: "units.manage", body: unitSchema },
  async ({ context, actor, body }) => createUnit({ context, actor }, body),
);
