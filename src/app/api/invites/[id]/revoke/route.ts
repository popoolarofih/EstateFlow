import { apiRoute } from "@/lib/api/handler";
import { revokeInvite } from "@/server/services/members";

export const POST = apiRoute({ auth: "member", action: "members.manage" }, async ({ context, actor, params }) => {
  await revokeInvite({ context, actor }, params.id!);
  return { ok: true };
});
