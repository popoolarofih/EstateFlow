import { apiRoute } from "@/lib/api/handler";
import { importSchema } from "@/lib/validation/members";
import { importResidents } from "@/server/services/units";

export const POST = apiRoute(
  { auth: "member", action: "residents.import", body: importSchema },
  async ({ context, actor, body }) => importResidents({ context, actor }, body),
);
