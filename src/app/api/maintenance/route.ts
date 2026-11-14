import { apiRoute } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { filesFrom } from "@/lib/uploads";
import { createTicketSchema } from "@/lib/validation/maintenance";
import { createTicket } from "@/server/services/maintenance";

export const POST = apiRoute(
  { auth: "member", action: "maintenance.create", multipart: true, rateLimit: ({ uid }) => [RATE_LIMITS.upload, uid ?? "anonymous"] },
  async ({ context, actor, request }) => {
    const form = await request.formData();
    const input = createTicketSchema.parse(Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string")));
    return createTicket({ context, actor }, input, filesFrom(form, "photos", 4));
  },
);
