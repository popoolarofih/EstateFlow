"use client";

import { Phone, Siren, WarningCircle } from "@/components/ui/icons";
import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api/client";
import { EMERGENCY_CATEGORY_LABELS } from "@/lib/emergency/workflow";
import { clientDb } from "@/lib/firebase/client";
import { formatTime } from "@/lib/time";
import { EMERGENCY_CATEGORIES, type EmergencyAlert, type EmergencyCategory, type EmergencyContact } from "@/types/domain";

const HOLD_MS = 2000;

function pickAlert<T extends { id: string; createdAt: Date }>(local: T | null, server: T | null): T | null {
  if (!local) return server;
  if (!server || local.id === server.id) return local;
  return local.createdAt > server.createdAt ? local : server;
}

type AlertView = Pick<EmergencyAlert, "id" | "status" | "category" | "acknowledgedByName" | "acknowledgedAt" | "createdAt">;

/**
 * Emergency alert with a deliberate press and hold gesture, clear submitted / failed and
 * acknowledged / not acknowledged states, and estate fallback contacts (blueprint section 11).
 */
export function EmergencyPanel({
  contacts,
  activeAlert,
  timezone,
}: {
  contacts: EmergencyContact[];
  activeAlert: AlertView | null;
  timezone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<EmergencyCategory>("security");
  const [location, setLocation] = useState("");
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "failed">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  // Local copy for an alert raised on this screen and for live updates; the newest alert wins.
  const [local, setAlert] = useState<AlertView | null>(null);
  const alert = pickAlert(local, activeAlert);
  const timer = useRef<number | null>(null);
  const started = useRef(0);

  // Live status for the resident's own alert; falls back to periodic refresh if the listener fails.
  useEffect(() => {
    if (!alert || alert.status === "resolved") return;
    let fallback: number | null = null;
    const unsubscribe = onSnapshot(
      doc(clientDb(), "emergencyAlerts", alert.id),
      (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        setAlert({
          id: snapshot.id,
          status: data.status,
          category: data.category,
          acknowledgedByName: data.acknowledgedByName ?? null,
          acknowledgedAt: data.acknowledgedAt?.toDate?.() ?? null,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        });
      },
      () => {
        fallback = window.setInterval(() => router.refresh(), 10_000);
      },
    );
    return () => {
      unsubscribe();
      if (fallback) window.clearInterval(fallback);
    };
  }, [alert?.id, alert?.status, router]); // eslint-disable-line react-hooks/exhaustive-deps

  function cancelHold() {
    if (timer.current) window.cancelAnimationFrame(timer.current);
    timer.current = null;
    if (state !== "sending") setProgress(0);
  }

  async function send() {
    setState("sending");
    setFailure(null);
    try {
      const { id } = await api<{ id: string }>("/api/emergencies", { json: { category, locationText: location } });
      setAlert({ id, status: "open", category, acknowledgedByName: null, acknowledgedAt: null, createdAt: new Date() });
      setState("idle");
      setOpen(false);
      setProgress(0);
      router.refresh();
    } catch (error) {
      setState("failed");
      setFailure(errorMessage(error));
      setProgress(0);
    }
  }

  function startHold() {
    if (state === "sending") return;
    started.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - started.current;
      const ratio = Math.min(1, elapsed / HOLD_MS);
      setProgress(ratio);
      if (ratio >= 1) {
        timer.current = null;
        void send();
        return;
      }
      timer.current = window.requestAnimationFrame(tick);
    };
    timer.current = window.requestAnimationFrame(tick);
  }

  const contactList = (
    <div className="flex flex-col gap-2">
      <p className="caption-1 text-muted">If you cannot reach estate security, call:</p>
      <ul className="flex flex-col gap-2">
        {contacts.map((contact) => (
          <li key={contact.phone}>
            <a href={`tel:${contact.phone}`} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 py-2 body-5 text-ink hover:bg-canvas">
              <Phone size={20} aria-hidden /> {contact.label}: {contact.phone}
            </a>
          </li>
        ))}
        <li>
          <a href="tel:112" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 py-2 body-5 text-ink hover:bg-canvas">
            <Phone size={20} aria-hidden /> National emergency line: 112
          </a>
        </li>
      </ul>
    </div>
  );

  if (alert && alert.status !== "resolved") {
    const acknowledged = alert.status === "acknowledged";
    return (
      <section aria-live="assertive" className={cx("flex flex-col gap-4 rounded-2xl border p-4", acknowledged ? "border-gold/50 bg-gold-soft" : "border-alert/40 bg-alert-soft")}>
        <div className="flex items-start gap-3">
          <Siren size={28} className={acknowledged ? "text-gold-ink" : "text-alert-ink"} aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="body-4 text-ink">Alert sent: {EMERGENCY_CATEGORY_LABELS[alert.category]}</p>
            <p className="body-6 text-ink">
              {acknowledged
                ? `Acknowledged by ${alert.acknowledgedByName ?? "estate security"}${alert.acknowledgedAt ? ` at ${formatTime(alert.acknowledgedAt, timezone)}` : ""}. Help is responding.`
                : "Not acknowledged yet. Security and managers have been notified. Keep your phone close."}
            </p>
          </div>
        </div>
        {!acknowledged && contactList}
        <p className="caption-2 text-muted">EstateFlow alerts your estate team. It does not replace emergency services.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="title-2 text-ink">Emergency</h2>
          <p className="body-6 text-muted">Alerts gate security and estate managers immediately.</p>
        </div>
        <Button variant="danger" icon={<Siren size={20} aria-hidden />} onClick={() => setOpen(true)}>
          Raise alert
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => {
          if (state !== "sending") {
            setOpen(false);
            setState("idle");
            setFailure(null);
          }
        }}
        title="Raise an emergency alert"
        description="Choose what is happening, then press and hold the button for two seconds."
      >
        <Field id="emergency-category" label="What is happening?">
          <Select id="emergency-category" value={category} onChange={(event) => setCategory(event.target.value as EmergencyCategory)}>
            {EMERGENCY_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {EMERGENCY_CATEGORY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="emergency-location" label="Where exactly?" optional>
          <Textarea id="emergency-location" rows={2} maxLength={200} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="For example: back gate, beside the generator house" />
        </Field>
        {state === "failed" && (
          <Notice tone="error" title="Alert not sent">
            <span className="inline-flex items-start gap-2">
              <WarningCircle size={18} aria-hidden className="mt-0.5 shrink-0" />
              {failure} Try again, or use the numbers below.
            </span>
          </Notice>
        )}
        <button
          type="button"
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={(event) => {
            if ((event.key === " " || event.key === "Enter") && !event.repeat) startHold();
          }}
          onKeyUp={cancelHold}
          onContextMenu={(event) => event.preventDefault()}
          disabled={state === "sending"}
          aria-describedby="hold-help"
          className="relative isolate min-h-16 select-none overflow-hidden rounded-2xl bg-alert px-3 py-2 button-lg text-white transition duration-300 ease-weighted active:scale-[0.98] disabled:opacity-80"
          style={{ touchAction: "none" }}
        >
          <span
            aria-hidden
            className="absolute inset-0 -z-10 origin-left bg-alert-ink"
            style={{ transform: `scaleX(${progress})` }}
          />
          {state === "sending" ? "Sending alert…" : progress > 0 ? "Keep holding…" : "Press and hold to send"}
        </button>
        <p id="hold-help" className="caption-2 text-muted">
          Holding for two seconds prevents accidental alerts. Keyboard users can hold Space or Enter.
        </p>
        {state === "failed" && contactList}
      </Dialog>
    </section>
  );
}
