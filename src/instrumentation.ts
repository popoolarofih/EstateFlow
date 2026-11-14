import type { Instrumentation } from "next";

/** Server error monitoring for pages, route handlers and server actions. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { reportError } = await import("@/lib/monitoring/report");
  const message = error instanceof Error ? error.message : String(error);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;
  // Path only: the query string can carry tokens (invites, payment references).
  const path = request.path.split("?")[0] ?? null;
  await reportError({ source: "server", message, digest, path, routeType: context.routeType }, error);
};
