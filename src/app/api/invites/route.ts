import { apiRoute } from "@/lib/api/handler";
import { createInviteSchema } from "@/lib/validation/members";
import { createInvite } from "@/server/services/members";

export const POST = apiRoute(
  { auth: "member", action: "members.manage", body: createInviteSchema },
  async ({ context, actor, body }) => createInvite({ context, actor }, body),
);
