import { logger } from "@/lib/logger";

/**
 * Error reporting: every captured error becomes a structured ERROR log (Cloud Logging and Vercel
 * log alerts key on `severity`). If ERROR_ALERT_WEBHOOK_URL is set (Slack, Discord, PagerDuty
 * Events, etc.), a short summary is also posted there. No request bodies, cookies or personal data.
 */
export interface ErrorReport {
  source: "server" | "client";
  message: string;
  digest?: string | null;
  path?: string | null;
  routeType?: string | null;
}

export async function reportError(report: ErrorReport, error?: unknown): Promise<void> {
  logger.error(`${report.source} error`, { ...report, error });
  const webhook = process.env.ERROR_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `EstateFlow ${report.source} error on ${report.path ?? "unknown path"}: ${report.message.slice(0, 300)}${report.digest ? ` (digest ${report.digest})` : ""}`,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (webhookError) {
    logger.warn("error alert webhook failed", { error: webhookError });
  }
}
