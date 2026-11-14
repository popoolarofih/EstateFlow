import { apiRoute } from "@/lib/api/handler";
import { approveLedgerEntry } from "@/server/services/ledger";

export const POST = apiRoute({ auth: "member", action: "ledger.approve" }, async ({ context, actor, params }) => ({
  status: await approveLedgerEntry({ context, actor }, params.id!),
}));
