"use client";

import { Backspace, CheckCircle, Prohibit, QrCode, WarningCircle, WifiSlash } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { cx } from "@/components/ui/cx";
import { api, ApiError } from "@/lib/api/client";
import { formatDateTime, formatTime } from "@/lib/time";
import type { EmergencyContact, Gate } from "@/types/domain";
import { GatePicker } from "./gate-picker";
import { QrScanner, qrScanningSupported } from "./qr-scanner";
import { useGate } from "./use-gate";

interface Verification {
  allow: boolean;
  tone: "allow" | "deny" | "caution";
  headline: string;
  detail: string;
  unitLabel: string | null;
  guestName: string | null;
  passTypeLabel: string | null;
  validUntil: string | null;
  priorUseAt: string | null;
  photoPath: string | null;
}

type Outcome = { kind: "result"; result: Verification } | { kind: "offline" } | { kind: "error"; message: string };

const noopSubscribe = () => () => undefined;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const RESET_AFTER_MS = 20_000;

/**
 * Full screen gate verifier: large keypad, optional QR scan, and an unmistakable decision that
 * uses words and icons as well as colour (blueprint section 9).
 */
export function GateVerifier({ gates, timezone, contacts }: { gates: Gate[]; timezone: string; contacts: EmergencyContact[] }) {
  const [gateId, setGateId] = useGate(gates);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [scanning, setScanning] = useState(false);
  const canScan = useSyncExternalStore(noopSubscribe, qrScanningSupported, () => false);
  // False in the server HTML, true once the keypad is interactive.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const reset = useCallback(() => {
    setOutcome(null);
    setCode("");
  }, []);

  useEffect(() => {
    if (!outcome) return;
    const timer = window.setTimeout(reset, RESET_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [outcome, reset]);

  const verify = useCallback(
    async (payload: { method: "code"; code: string } | { method: "qr"; qr: string }) => {
      if (!gateId) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setOutcome({ kind: "offline" });
        return;
      }
      setPending(true);
      try {
        const result = await api<Verification>("/api/passes/verify", { json: { ...payload, gateId } });
        setOutcome({ kind: "result", result });
      } catch (error) {
        if (error instanceof ApiError && error.code === "network") setOutcome({ kind: "offline" });
        else setOutcome({ kind: "error", message: error instanceof ApiError ? error.message : "Verification failed. Try again." });
      } finally {
        setPending(false);
      }
    },
    [gateId],
  );

  const press = useCallback(
    (digit: string) => {
      if (pending || outcome) return;
      setCode((current) => {
        if (current.length >= 6) return current;
        const next = current + digit;
        if (next.length === 6) void verify({ method: "code", code: next });
        return next;
      });
    },
    [outcome, pending, verify],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (scanning) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") setCode((current) => current.slice(0, -1));
      else if (event.key === "Escape") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, reset, scanning]);

  if (gates.length === 0) {
    return <p className="rounded-2xl bg-white/10 p-6 body-3 text-white">You are not assigned to a gate yet. Ask your estate manager to assign you.</p>;
  }

  if (outcome) {
    return <OutcomePanel outcome={outcome} timezone={timezone} contacts={contacts} onNext={reset} />;
  }

  return (
    <div className="flex flex-col gap-6" data-ready={ready}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GatePicker gates={gates} gateId={gateId} onChange={setGateId} />
        {canScan && (
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 button-lg text-white transition duration-300 ease-weighted hover:bg-white/20 active:scale-[0.98]"
          >
            <QrCode size={28} aria-hidden /> Scan QR
          </button>
        )}
      </div>

      <div aria-live="polite" className="flex justify-center gap-2" aria-label={`Code entered: ${code.length} of 6 digits`}>
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={cx(
              "flex h-16 w-12 items-center justify-center rounded-xl border-2 font-mono heading-4 text-white sm:h-20 sm:w-16",
              index < code.length ? "border-teal bg-white/10" : "border-white/20",
            )}
          >
            {code[index] ?? ""}
          </span>
        ))}
      </div>
      {pending && (
        <p role="status" className="text-center title-2 text-white">
          Checking pass…
        </p>
      )}

      <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <KeypadButton key={key} label={key} onPress={() => press(key)} disabled={pending} />
        ))}
        <KeypadButton label="Clear" onPress={() => setCode("")} disabled={pending} small />
        <KeypadButton label="0" onPress={() => press("0")} disabled={pending} />
        <KeypadButton
          label={<Backspace size={32} aria-hidden />}
          ariaLabel="Delete last digit"
          onPress={() => setCode((current) => current.slice(0, -1))}
          disabled={pending}
        />
      </div>

      {scanning && (
        <QrScanner
          onClose={() => setScanning(false)}
          onResult={(value) => {
            setScanning(false);
            void verify({ method: "qr", qr: value });
          }}
        />
      )}
    </div>
  );
}

function KeypadButton({
  label,
  onPress,
  disabled,
  small,
  ariaLabel,
}: {
  label: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(
        "flex h-20 items-center justify-center rounded-2xl bg-white/10 text-white transition duration-300 ease-weighted hover:bg-white/20 active:scale-[0.98] disabled:opacity-50",
        small ? "button-lg" : "heading-4 font-mono",
      )}
    >
      {label}
    </button>
  );
}

const TONE_STYLES = {
  allow: { panel: "bg-teal text-navy", icon: CheckCircle },
  deny: { panel: "bg-alert text-white", icon: Prohibit },
  caution: { panel: "bg-gold text-navy", icon: WarningCircle },
} as const;

function OutcomePanel({
  outcome,
  timezone,
  contacts,
  onNext,
}: {
  outcome: Outcome;
  timezone: string;
  contacts: EmergencyContact[];
  onNext: () => void;
}) {
  let tone: keyof typeof TONE_STYLES = "caution";
  let headline = "Connection lost";
  let detail = "Do not allow entry on an unverified code. Call a supervisor.";
  let Icon: typeof CheckCircle = WifiSlash;
  let result: Verification | null = null;

  if (outcome.kind === "result") {
    result = outcome.result;
    tone = result.tone;
    headline = result.headline;
    detail = result.detail;
    Icon = TONE_STYLES[tone].icon;
  } else if (outcome.kind === "error") {
    tone = "caution";
    headline = "Could not verify";
    detail = outcome.message;
    Icon = WarningCircle;
  }

  return (
    <div className="flex flex-col gap-4">
      <section role="alert" aria-live="assertive" className={cx("flex flex-col items-center gap-4 rounded-3xl px-6 py-10 text-center", TONE_STYLES[tone].panel)}>
        <Icon size={80} weight="fill" aria-hidden />
        <p className="heading-3 uppercase tracking-wide md:heading-2">{headline}</p>
        {result?.unitLabel && <p className="heading-4">Unit {result.unitLabel}</p>}
        {result?.guestName && (
          <p className="title-1">
            {result.guestName}
            {result.passTypeLabel ? ` · ${result.passTypeLabel}` : ""}
          </p>
        )}
        {result?.photoPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files?path=${encodeURIComponent(result.photoPath)}`} alt={`Photo of ${result.guestName ?? "the staff member"}`} className="size-40 rounded-2xl border-4 border-white object-cover" />
        )}
        <p className="body-2">{detail}</p>
        {result?.allow && result.validUntil && <p className="caption-1">Pass valid until {formatDateTime(new Date(result.validUntil), timezone)}</p>}
        {result?.priorUseAt && <p className="caption-1">Last used at {formatTime(new Date(result.priorUseAt), timezone)}</p>}
      </section>
      {outcome.kind === "offline" && contacts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {contacts.map((contact) => (
            <li key={contact.phone}>
              <a href={`tel:${contact.phone}`} className="flex min-h-14 items-center justify-center rounded-2xl bg-white/10 px-3 py-2 button-lg text-white">
                Call {contact.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="min-h-16 rounded-2xl bg-white px-3 py-2 button-lg text-navy transition duration-300 ease-weighted hover:bg-canvas active:scale-[0.98]"
      >
        Next visitor
      </button>
    </div>
  );
}
