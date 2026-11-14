import "server-only";
import type { ActiveContext } from "@/lib/auth/authorize";
import type { AuditActor } from "@/lib/audit/audit";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { InAppChannel, Notifier, PushChannel, type NotificationChannel } from "@/lib/notifications/notify";

/** Every mutating service receives the authorised tenant context and the audit actor. */
export interface ServiceContext {
  context: ActiveContext;
  actor: AuditActor;
}

let notifier: Notifier | null = null;

export function appNotifier(): Notifier {
  if (!notifier) {
    const channels: NotificationChannel[] = [new InAppChannel(adminDb())];
    if (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) channels.push(new PushChannel(adminDb(), adminMessaging()));
    notifier = new Notifier(channels);
  }
  return notifier;
}
