import { apiRoute } from "@/lib/api/handler";
import { roleHome } from "@/lib/auth/permissions";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { acceptInviteSchema } from "@/lib/validation/members";
import { acceptInvite } from "@/server/services/members";

export const POST = apiRoute(
  { auth: "user", body: acceptInviteSchema, rateLimit: ({ ip }) => [RATE_LIMITS.inviteAccept, ip] },
  async ({ user, body, meta }) => {
    const result = await acceptInvite(user, body.token, meta);
    return { redirectTo: roleHome(result.role) };
  },
);
