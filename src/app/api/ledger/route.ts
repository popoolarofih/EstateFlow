import { apiRoute } from "@/lib/api/handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { filesFrom } from "@/lib/uploads";
import { ledgerDraftSchema } from "@/lib/validation/ledger";
import { createLedgerDraft } from "@/server/services/ledger";

export const POST = apiRoute(
  { auth: "member", action: "ledger.draft", multipart: true, rateLimit: ({ uid }) => [RATE_LIMITS.upload, uid ?? "anonymous"] },
  async ({ context, actor, request }) => {
    const form = await request.formData();
    const input = ledgerDraftSchema.parse(Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === "string")));
    return createLedgerDraft({ context, actor }, input, filesFrom(form, "evidence", 5));
  },
);
