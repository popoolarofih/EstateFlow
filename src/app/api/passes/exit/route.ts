import { apiRoute } from "@/lib/api/handler";
import { recordExitSchema } from "@/lib/validation/passes";
import { recordVisitorExit } from "@/server/services/passes";

export const POST = apiRoute(
  { auth: "member", action: "pass.verify", body: recordExitSchema },
  async ({ context, actor, body }) => recordVisitorExit({ context, actor }, body),
);
