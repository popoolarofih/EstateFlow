import { apiRoute } from "@/lib/api/handler";
import { commentTicketSchema } from "@/lib/validation/maintenance";
import { commentOnTicket } from "@/server/services/maintenance";

export const POST = apiRoute(
  { auth: "member", action: "maintenance.comment", body: commentTicketSchema },
  async ({ context, actor, params, body }) => {
    await commentOnTicket({ context, actor }, params.id!, body);
    return { ok: true };
  },
);
