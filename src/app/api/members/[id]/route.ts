import { apiRoute } from "@/lib/api/handler";
import { updateMemberSchema } from "@/lib/validation/members";
import { updateMember } from "@/server/services/members";

export const PATCH = apiRoute(
  { auth: "member", action: "members.manage", body: updateMemberSchema },
  async ({ context, actor, params, body }) => {
    await updateMember({ context, actor }, params.id!, body);
    return { ok: true };
  },
);
