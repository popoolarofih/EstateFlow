import { apiRoute } from "@/lib/api/handler";
import { ledgerReverseSchema } from "@/lib/validation/ledger";
import { reverseLedgerEntry } from "@/server/services/ledger";

export const POST = apiRoute(
  { auth: "member", action: "ledger.draft", body: ledgerReverseSchema },
  async ({ context, actor, params, body }) => reverseLedgerEntry({ context, actor }, params.id!, body.reason),
);
