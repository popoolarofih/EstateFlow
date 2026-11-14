"use client";

import { Camera, Copy, Plus, ShareNetwork, WhatsappLogo } from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { api, errorMessage } from "@/lib/api/client";
import { compressImage } from "@/lib/images/compress";
import { PASS_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";
import { PASS_TYPES, type Gate, type PassType } from "@/types/domain";

interface IssuedPass {
  passId: string;
  code: string;
  qrPayload: string;
  guestName: string;
  unitLabel: string;
  validFrom: string;
  validUntil: string;
  passType: PassType;
}

const DEFAULT_HOURS: Record<Exclude<PassType, "staff">, number> = { guest: 6, delivery: 2, contractor: 8 };

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateInput(date: Date): string {
  return toLocalInput(date).slice(0, 10);
}

export function PassManager({
  estateName,
  gates,
  timezone,
  startOpen,
}: {
  estateName: string;
  gates: Gate[];
  timezone: string;
  startOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [passType, setPassType] = useState<PassType>("guest");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [issued, setIssued] = useState<IssuedPass | null>(null);
  const now = useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    setFieldErrors({});
    const allowedGateIds = gates.length > 1 ? form.getAll("gate").map(String) : [];
    let payload: Record<string, unknown> = {
      passType,
      guestName: text(form, "guestName"),
      guestPhone: text(form, "guestPhone") || undefined,
      allowedGateIds: allowedGateIds.length === gates.length ? [] : allowedGateIds,
    };
    try {
      if (passType === "staff") {
        const startDate = text(form, "startDate");
        const endDate = text(form, "endDate");
        const startAt = new Date(`${startDate}T00:00`);
        payload = {
          ...payload,
          // A staff pass created today starts now rather than at midnight in the past.
          validFrom: (startAt < new Date() ? new Date() : startAt).toISOString(),
          validUntil: new Date(`${endDate}T23:59`).toISOString(),
          recurrence: {
            daysOfWeek: form.getAll("day").map(Number),
            startTime: text(form, "startTime"),
            endTime: text(form, "endTime"),
          },
        };
      } else {
        payload = {
          ...payload,
          validFrom: new Date(text(form, "validFrom")).toISOString(),
          validUntil: new Date(text(form, "validUntil")).toISOString(),
        };
      }
    } catch {
      setPending(false);
      setError("Check the dates and times.");
      return;
    }
    try {
      const result = await api<IssuedPass>("/api/passes", { json: payload });
      setIssued(result);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setFieldErrors((caught as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {});
    } finally {
      setPending(false);
    }
  }

  const fe = (name: string) => fieldErrors[name]?.[0];

  return (
    <>
      <Button icon={<Plus size={20} aria-hidden />} onClick={() => setOpen(true)}>
        New pass
      </Button>

      <Dialog open={open} onClose={() => !pending && setOpen(false)} title="Create a visitor pass" description="The code works only at your estate gates and only inside the times you set.">
        <form onSubmit={submitWith(submit)} className="flex flex-col gap-4" noValidate>
          {error && <Notice tone="error">{error}</Notice>}
          <Field id="passType" label="Pass type">
            <Select id="passType" value={passType} onChange={(event) => setPassType(event.target.value as PassType)}>
              {PASS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PASS_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="guestName" label={passType === "staff" ? "Staff member name" : "Visitor name"} error={fe("guestName")}>
            <Input id="guestName" name="guestName" autoComplete="off" required maxLength={80} aria-invalid={Boolean(fe("guestName"))} />
          </Field>
          <Field id="guestPhone" label="Phone number" optional hint="Used only to share the pass. Gate security never sees it." error={fe("guestPhone")}>
            <Input id="guestPhone" name="guestPhone" type="tel" inputMode="tel" placeholder="0803 123 4567" aria-invalid={Boolean(fe("guestPhone"))} />
          </Field>

          {passType === "staff" ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="title-4 text-ink">Allowed days</legend>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <label key={label} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line px-2 py-2 body-5 has-[:checked]:border-violet has-[:checked]:bg-violet-soft">
                      <input type="checkbox" name="day" value={index} defaultChecked={index >= 1 && index <= 5} className="size-4 accent-violet" />
                      {label}
                    </label>
                  ))}
                </div>
                {fe("recurrence") && <p className="caption-1 text-alert-ink">{fe("recurrence")}</p>}
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <Field id="startTime" label="From">
                  <Input id="startTime" name="startTime" type="time" defaultValue="07:00" required />
                </Field>
                <Field id="endTime" label="Until">
                  <Input id="endTime" name="endTime" type="time" defaultValue="18:00" required />
                </Field>
                <Field id="startDate" label="Start date">
                  <Input id="startDate" name="startDate" type="date" defaultValue={toDateInput(now)} required />
                </Field>
                <Field id="endDate" label="End date" hint="Up to 180 days.">
                  <Input id="endDate" name="endDate" type="date" defaultValue={toDateInput(new Date(now.getTime() + 90 * 86_400_000))} required />
                </Field>
              </div>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="validFrom" label="Arrives from" error={fe("validFrom")}>
                <Input id="validFrom" name="validFrom" type="datetime-local" defaultValue={toLocalInput(now)} required />
              </Field>
              <Field id="validUntil" label="Pass ends" error={fe("validUntil")}>
                <Input
                  key={passType}
                  id="validUntil"
                  name="validUntil"
                  type="datetime-local"
                  defaultValue={toLocalInput(new Date(now.getTime() + DEFAULT_HOURS[passType] * 3_600_000))}
                  required
                />
              </Field>
            </div>
          )}

          {gates.length > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="title-4 text-ink">Gates</legend>
              <div className="flex flex-wrap gap-2">
                {gates.map((gate) => (
                  <label key={gate.id} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 body-5 has-[:checked]:border-violet has-[:checked]:bg-violet-soft">
                    <input type="checkbox" name="gate" value={gate.id} defaultChecked className="size-4 accent-violet" />
                    {gate.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" pending={pending} pendingLabel="Creating pass…">
              Create pass
            </Button>
          </div>
        </form>
      </Dialog>

      {issued && <IssuedPassDialog pass={issued} estateName={estateName} timezone={timezone} onClose={() => setIssued(null)} />}
    </>
  );
}

function IssuedPassDialog({ pass, estateName, timezone, onClose }: { pass: IssuedPass; estateName: string; timezone: string; onClose: () => void }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [photoState, setPhotoState] = useState<{ pending: boolean; message: string | null; tone: "success" | "error" }>({
    pending: false,
    message: null,
    tone: "success",
  });

  useEffect(() => {
    QRCode.toDataURL(pass.qrPayload, { margin: 1, width: 480, errorCorrectionLevel: "M", color: { dark: "#101B35", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [pass.qrPayload]);

  const message = `Hello ${pass.guestName}, your gate pass for ${estateName} is ${pass.code}. It is valid from ${formatDateTime(new Date(pass.validFrom), timezone)} until ${formatDateTime(new Date(pass.validUntil), timezone)}. Show this code at the gate.`;

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "Gate pass", text: message }).catch(() => undefined);
    } else {
      await copy();
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoState({ pending: true, message: null, tone: "success" });
    const form = new FormData();
    form.append("photo", await compressImage(file, { maxDimension: 800 }));
    try {
      await api(`/api/passes/${pass.passId}/photo`, { formData: form });
      setPhotoState({ pending: false, message: "Photo added. Gate security will see it when verifying.", tone: "success" });
      router.refresh();
    } catch (error) {
      setPhotoState({ pending: false, message: errorMessage(error), tone: "error" });
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Pass ready for ${pass.guestName}`} description="Share it now. For your security the code is shown only once; revoke and create a new pass if it is lost.">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-canvas p-4">
        <p className="caption-1 text-muted">Gate code</p>
        <p className="heading-2 font-mono tracking-widest text-navy" aria-label={`Gate code ${pass.code.split("").join(" ")}`}>
          {pass.code}
        </p>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR pass for ${pass.guestName}`} width={240} height={240} className="rounded-xl bg-white p-2" />
        ) : (
          <div className="size-60 animate-pulse rounded-xl bg-line" aria-hidden />
        )}
        <p className="caption-2 text-muted">
          Unit {pass.unitLabel} · until {formatDateTime(new Date(pass.validUntil), timezone)}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button icon={<ShareNetwork size={20} aria-hidden />} onClick={share}>
          Share
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 button-md text-ink transition duration-300 ease-weighted hover:bg-canvas active:scale-[0.98]"
        >
          <WhatsappLogo size={20} aria-hidden /> WhatsApp
        </a>
        <Button variant="secondary" icon={<Copy size={20} aria-hidden />} onClick={copy}>
          {copied ? "Copied" : "Copy text"}
        </Button>
      </div>
      {pass.passType === "staff" && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line p-4">
          <p className="title-4 text-ink">Add a photo of {pass.guestName}</p>
          <p className="caption-2 text-muted">Optional. Helps gate security confirm the right person. JPEG, PNG or WebP. Large photos are resized automatically.</p>
          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong px-3 py-2 button-md text-ink hover:bg-canvas">
            <Camera size={20} aria-hidden />
            {photoState.pending ? "Uploading…" : "Choose photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(event) => uploadPhoto(event.target.files?.[0])} disabled={photoState.pending} />
          </label>
          {photoState.message && <Notice tone={photoState.tone}>{photoState.message}</Notice>}
        </div>
      )}
      <Button variant="ghost" onClick={onClose}>
        Done
      </Button>
    </Dialog>
  );
}
