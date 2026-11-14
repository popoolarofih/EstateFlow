import { apiRoute } from "@/lib/api/handler";
import { revokeVisitorPass } from "@/server/services/passes";

export const POST = apiRoute(
  { auth: "member", action: ["pass.revoke.own", "pass.revoke.any"] },
  async ({ context, actor, params }) => {
    await revokeVisitorPass({ context, actor }, params.id!);
    return { ok: true };
  },
);
