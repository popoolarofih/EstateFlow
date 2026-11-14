import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { reportError } from "@/lib/monitoring/report";
import { RATE_LIMITS } from "@/lib/rate-limit";

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  digest: z.string().max(100).nullish(),
  path: z.string().max(200).nullish(),
});

/** Browser crash reports from error boundaries. Rate limited per IP; no auth needed. */
export const POST = apiRoute(
  { auth: "public", body: schema, rateLimit: ({ ip }) => [RATE_LIMITS.clientError, ip] },
  async ({ body }) => {
    await reportError({ source: "client", message: body.message, digest: body.digest ?? null, path: body.path?.split("?")[0] ?? null });
    return { ok: true };
  },
);
