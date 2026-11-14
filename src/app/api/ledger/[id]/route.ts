import { apiRoute } from "@/lib/api/handler";
import { discardLedgerDraft } from "@/server/services/ledger";

export const DELETE = apiRoute({ auth: "member", action: "ledger.draft" }, async ({ context, actor, params }) => {
  await discardLedgerDraft({ context, actor }, params.id!);
  return { ok: true };
});
