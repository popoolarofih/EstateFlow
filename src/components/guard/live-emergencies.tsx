"use client";

import { Siren } from "@/components/ui/icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui/cx";
import { api, errorMessage } from "@/lib/api/client";
import { EMERGENCY_CATEGORY_LABELS } from "@/lib/emergency/workflow";
import { clientDb } from "@/lib/firebase/client";
import { formatTime } from "@/lib/time";
import type { EmergencyAlert } from "@/types/domain";

export type LiveAlert = Pick<
  EmergencyAlert,
  "id" | "unitLabel" | "category" | "locationText" | "status" | "createdAt" | "acknowledgedByName" | "callbackPhone"
>;

/**
 * Open emergency alerts for the estate, live through Firestore (rules restrict this query to
 * guards and managers of the estate). Falls back to periodic refresh if the listener fails.
 */
export function LiveEmergencies({
  estateId,
  initial,
  timezone,
  tone = "dark",
}: {
  estateId: string;
  initial: LiveAlert[];
  timezone: string;
  tone?: "dark" | "light";
}) {
  const router = useRouter();
  // Live snapshot once the listener delivers; the server rendered list until then.
  const [live, setAlerts] = useState<LiveAlert[] | null>(null);
  const alerts = live ?? initial;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let fallback: number | null = null;
    const unsubscribe = onSnapshot(
      query(collection(clientDb(), "emergencyAlerts"), where("estateId", "==", estateId), where("status", "in", ["open", "acknowledged"])),
      (snapshot) => {
        setAlerts(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              unitLabel: data.unitLabel,
              category: data.category,
              locationText: data.locationText ?? "",
              status: data.status,
              createdAt: data.createdAt?.toDate?.() ?? new Date(),
              acknowledgedByName: data.acknowledgedByName ?? null,
              callbackPhone: data.callbackPhone ?? null,
            };
          }),
        );
      },
      () => {
        fallback = window.setInterval(() => router.refresh(), 15_000);
      },
    );
    return () => {
      unsubscribe();
      if (fallback) window.clearInterval(fallback);
    };
  }, [estateId, router]);

  if (alerts.length === 0) return null;

  return (
    <section aria-live="assertive" aria-label="Active emergencies" className="flex flex-col gap-3">
      {error && (
        <p role="alert" className={cx("rounded-xl p-3 body-5", tone === "dark" ? "bg-white/10 text-white" : "bg-alert-soft text-alert-ink")}>
          {error}
        </p>
      )}
      {alerts.map((alert) => (
        <article key={alert.id} className={cx("flex flex-col gap-3 rounded-2xl border-2 p-4", alert.status === "open" ? "border-alert bg-alert text-white" : "border-gold bg-gold-soft text-navy")}>
          <div className="flex items-start gap-3">
            <Siren size={32} weight="fill" aria-hidden className="shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="title-1">
                {EMERGENCY_CATEGORY_LABELS[alert.category]} at {alert.unitLabel}
              </p>
              {alert.locationText && <p className="body-5">{alert.locationText}</p>}
              <p className="caption-1">
                Raised {formatTime(alert.createdAt, timezone)}
                {alert.status === "acknowledged" && alert.acknowledgedByName ? ` · acknowledged by ${alert.acknowledgedByName}` : " · not acknowledged"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {alert.status === "open" && (
              <button
                type="button"
                disabled={pendingId === alert.id}
                onClick={async () => {
                  setPendingId(alert.id);
                  setError(null);
                  try {
                    await api(`/api/emergencies/${alert.id}/acknowledge`, { method: "POST" });
                    router.refresh();
                  } catch (caught) {
                    setError(errorMessage(caught));
                  } finally {
                    setPendingId(null);
                  }
                }}
                className="min-h-12 rounded-xl bg-white px-3 py-2 button-md text-navy transition duration-300 ease-weighted active:scale-[0.98] disabled:opacity-70"
              >
                {pendingId === alert.id ? "Acknowledging…" : "Acknowledge and respond"}
              </button>
            )}
            {alert.callbackPhone && (
              <a href={`tel:${alert.callbackPhone}`} className="inline-flex min-h-12 items-center rounded-xl border border-current px-3 py-2 button-md">
                Call resident
              </a>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
