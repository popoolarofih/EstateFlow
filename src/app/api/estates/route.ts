import { apiRoute } from "@/lib/api/handler";
import { createEstateSchema } from "@/lib/validation/estates";
import { createEstate } from "@/server/services/estates";

/** Platform administration only (custom claim `platformAdmin`, granted by a trusted script). */
export const POST = apiRoute({ auth: "platform", body: createEstateSchema }, async ({ actor, body }) =>
  createEstate(actor, body),
);
