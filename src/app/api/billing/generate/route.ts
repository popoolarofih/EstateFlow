import { apiRoute } from "@/lib/api/handler";
import { generateInvoicesSchema } from "@/lib/validation/billing";
import { generateInvoices } from "@/server/services/billing";

export const POST = apiRoute(
  { auth: "member", action: "invoice.manage", body: generateInvoicesSchema },
  async ({ context, actor, body }) => generateInvoices({ context, actor }, body.frequency),
);
