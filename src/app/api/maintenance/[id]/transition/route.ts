import { apiRoute } from "@/lib/api/handler";
import { transitionTicketSchema } from "@/lib/validation/maintenance";
import { transitionTicket } from "@/server/services/maintenance";

export const POST = apiRoute(
  { auth: "member", action: ["maintenance.manage", "maintenance.viewOwn"], body: transitionTicketSchema },
  async ({ context, actor, params, body }) => {
    await transitionTicket({ context, actor }, params.id!, body);
    return { ok: true };
  },
);
