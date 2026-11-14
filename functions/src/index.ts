/**
 * EstateFlow Cloud Functions (2nd gen): scheduled operational jobs. The job logic lives in
 * ../src/server/jobs and is bundled here, so the web app and the functions share one
 * implementation. Every job is idempotent, so retries and overlapping runs are safe.
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { setGlobalOptions } from "firebase-functions";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/scheduler";
import { InAppChannel, Notifier, PushChannel } from "@/lib/notifications/notify";
import { isQuarterStart } from "@/lib/billing/invoices";
import { generateInvoicesForEstate, markOverdueInvoices, sendDueSoonReminders } from "@/server/jobs/billing";
import { cleanupRateLimits, escalateEmergencies, expirePasses, flagOverdueVisits } from "@/server/jobs/operations";

initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const notifier = new Notifier([new InAppChannel(db), new PushChannel(db, getMessaging())]);

// Keep functions next to Firestore; Lagos estates are served best from europe-west.
setGlobalOptions({ region: "europe-west1", maxInstances: 5 });

const TIME_ZONE = "Africa/Lagos";
const retry = { retryCount: 3, minBackoffSeconds: 30 };

/** 1st of every month, 06:00 Lagos: invoices for estates that enabled automatic generation. */
export const generateInvoices = onSchedule({ schedule: "0 6 1 * *", timeZone: TIME_ZONE, ...retry, timeoutSeconds: 540 }, async () => {
  const now = new Date();
  const estates = await db
    .collection("estates")
    .where("status", "==", "active")
    .where("settings.autoGenerateInvoices", "==", true)
    .get();
  for (const estate of estates.docs) {
    const frequencies = isQuarterStart(now, String(estate.get("timezone") ?? TIME_ZONE)) ? (["monthly", "quarterly"] as const) : (["monthly"] as const);
    for (const frequency of frequencies) {
      try {
        const result = await generateInvoicesForEstate(db, notifier, { estateId: estate.id, frequency, now });
        logger.info("invoices generated", { estateId: estate.id, frequency, ...result });
      } catch (error) {
        // One failing estate must not block the others; the run is retried and is idempotent.
        logger.error("invoice generation failed", { estateId: estate.id, frequency, error });
      }
    }
  }
});

/** Daily 07:00: mark overdue invoices and send due soon reminders. */
export const invoiceReminders = onSchedule({ schedule: "0 7 * * *", timeZone: TIME_ZONE, ...retry }, async () => {
  const overdue = await markOverdueInvoices(db, notifier);
  const reminders = await sendDueSoonReminders(db, notifier);
  logger.info("invoice reminders", { overdue, reminders });
});

/** Every 15 minutes: expire passes past their window and release their code locks. */
export const expireVisitorPasses = onSchedule({ schedule: "every 15 minutes", timeZone: TIME_ZONE }, async () => {
  logger.info("passes expired", { count: await expirePasses(db) });
});

/** Every minute: escalate unacknowledged emergency alerts. */
export const escalateEmergencyAlerts = onSchedule({ schedule: "every 1 minutes", timeZone: TIME_ZONE }, async () => {
  const escalated = await escalateEmergencies(db, notifier);
  if (escalated > 0) logger.warn("emergencies escalated", { escalated });
});

/** Every 15 minutes: flag contractors and deliveries still inside after their expected departure. */
export const overdueVisitors = onSchedule({ schedule: "every 15 minutes", timeZone: TIME_ZONE }, async () => {
  logger.info("overdue visits flagged", { count: await flagOverdueVisits(db, notifier) });
});

/** Daily 03:00: delete expired rate limit windows. */
export const cleanup = onSchedule({ schedule: "0 3 * * *", timeZone: TIME_ZONE }, async () => {
  logger.info("rate limits cleaned", { count: await cleanupRateLimits(db) });
});
