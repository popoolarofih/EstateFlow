import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Messaging } from "firebase-admin/messaging";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { logger } from "@/lib/logger";

/**
 * Notification adapter (blueprint section 12). The product is not coupled to a provider:
 * in app notifications are always stored; push is attempted where a device token exists.
 * SMS (Termii) and WhatsApp channels can be added as further `NotificationChannel`s.
 */
export interface NotificationMessage {
  estateId: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  priority?: "normal" | "high";
}

export interface NotificationChannel {
  readonly name: string;
  deliver(recipientUids: readonly string[], message: NotificationMessage): Promise<void>;
}

export class InAppChannel implements NotificationChannel {
  readonly name = "in_app";

  constructor(private readonly db: Firestore) {}

  async deliver(recipientUids: readonly string[], message: NotificationMessage): Promise<void> {
    for (let i = 0; i < recipientUids.length; i += 400) {
      const batch = this.db.batch();
      for (const uid of recipientUids.slice(i, i + 400)) {
        batch.set(this.db.collection(COLLECTIONS.notifications).doc(), {
          estateId: message.estateId,
          uid,
          type: message.type,
          title: message.title,
          body: message.body,
          link: message.link ?? null,
          priority: message.priority ?? "normal",
          readAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }
}

export class PushChannel implements NotificationChannel {
  readonly name = "push";

  constructor(
    private readonly db: Firestore,
    private readonly messaging: Messaging,
  ) {}

  async deliver(recipientUids: readonly string[], message: NotificationMessage): Promise<void> {
    const tokens: { ref: FirebaseFirestore.DocumentReference; token: string }[] = [];
    for (const uid of recipientUids) {
      const snapshot = await this.db
        .collection(COLLECTIONS.users)
        .doc(uid)
        .collection(COLLECTIONS.pushTokens)
        .limit(5)
        .get();
      for (const doc of snapshot.docs) tokens.push({ ref: doc.ref, token: String(doc.get("token")) });
    }
    if (tokens.length === 0) return;
    const response = await this.messaging.sendEachForMulticast({
      tokens: tokens.map((entry) => entry.token),
      // Keep push bodies free of sensitive data; the app shows the details after sign in.
      notification: { title: message.title, body: message.body },
      webpush: {
        headers: { Urgency: message.priority === "high" ? "high" : "normal" },
        fcmOptions: message.link ? { link: message.link } : undefined,
      },
      data: { type: message.type, link: message.link ?? "" },
    });
    // Remove tokens the provider reports as permanently invalid.
    await Promise.all(
      response.responses.map(async (result, index) => {
        const code = result.error?.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          await tokens[index]!.ref.delete();
        }
      }),
    );
  }
}

export class Notifier {
  constructor(private readonly channels: readonly NotificationChannel[]) {}

  /** Delivers on every channel; a failing channel is logged and never blocks the others. */
  async send(recipientUids: readonly string[], message: NotificationMessage): Promise<void> {
    const unique = [...new Set(recipientUids)].filter(Boolean);
    if (unique.length === 0) return;
    const results = await Promise.allSettled(this.channels.map((channel) => channel.deliver(unique, message)));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error("notification channel failed", {
          channel: this.channels[index]!.name,
          type: message.type,
          error: result.reason,
        });
      }
    });
  }
}

/** Active member uids with any of the given roles in an estate. */
export async function memberUidsWithRoles(
  db: Firestore,
  estateId: string,
  roles: readonly string[],
): Promise<string[]> {
  const snapshot = await db
    .collection(COLLECTIONS.estateMembers)
    .where("estateId", "==", estateId)
    .where("status", "==", "active")
    .where("role", "in", [...roles])
    .limit(500)
    .get();
  return snapshot.docs.map((doc) => String(doc.get("uid")));
}
