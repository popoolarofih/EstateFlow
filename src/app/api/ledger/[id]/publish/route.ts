import { apiRoute } from "@/lib/api/handler";
import { publishLedgerEntry } from "@/server/services/ledger";

export const POST = apiRoute({ auth: "member", action: "ledger.publish" }, async ({ context, actor, params }) => {
  await publishLedgerEntry({ context, actor }, params.id!);
  return { ok: true };
});
