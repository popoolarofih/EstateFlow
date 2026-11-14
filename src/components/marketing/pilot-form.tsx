"use client";

import { CheckCircle } from "@/components/ui/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { track } from "@/lib/analytics/track";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import { normalizeNigerianPhone } from "@/lib/validation/common";

/** Time trap input, read at submit time (outside render). */
function millisecondsSincePageLoad(): number {
  return Math.round(performance.now());
}

type Errors = Partial<Record<"name" | "email" | "phone" | "estateName" | "city" | "units", string>>;

function validate(form: FormData): Errors {
  const errors: Errors = {};
  if (text(form, "name").length < 2) errors.name = "Enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(text(form, "email"))) errors.email = "Enter a valid email address.";
  if (!normalizeNigerianPhone(text(form, "phone"))) errors.phone = "Enter a valid Nigerian phone number, for example 0803 123 4567.";
  if (text(form, "estateName").length < 3) errors.estateName = "Enter the estate name.";
  if (text(form, "city").length < 2) errors.city = "Enter the city.";
  const units = Number(text(form, "units"));
  if (!Number.isInteger(units) || units < 5) errors.units = "Enter the number of units (at least 5).";
  return errors;
}

/** Primary conversion: request a pilot walkthrough. Validated in the browser and on the server. */
export function PilotForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-2xl bg-teal-soft p-6 text-teal-ink">
        <CheckCircle size={32} weight="fill" aria-hidden />
        <p className="title-2">Request received</p>
        <p className="body-6">We will contact you at {sentTo} to schedule the walkthrough.</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={submitWith(async (form) => {
        const found = validate(form);
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        setPending(true);
        setError(null);
        try {
          await api("/api/pilot-requests", {
            json: {
              name: text(form, "name"),
              email: text(form, "email"),
              phone: text(form, "phone"),
              estateName: text(form, "estateName"),
              city: text(form, "city"),
              units: Number(text(form, "units")),
              message: text(form, "message"),
              website: text(form, "website"),
              // Time trap: milliseconds since the page loaded; the server drops instant submissions.
              elapsedMs: millisecondsSincePageLoad(),
            },
          });
          setSentTo(text(form, "email"));
          // Conversion event with no personal data, only a size band.
          const units = Number(text(form, "units"));
          track("pilot_request_submitted", { size: units < 100 ? "under_100" : units < 300 ? "100_299" : "300_plus" });
        } catch (caught) {
          setError(errorMessage(caught));
          if (caught instanceof ApiError) {
            setErrors(Object.fromEntries(Object.entries(caught.fieldErrors).map(([key, value]) => [key, value[0]])) as Errors);
          }
        } finally {
          setPending(false);
        }
      })}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pilot-name" label="Your name" error={errors.name}>
          <Input id="pilot-name" name="name" autoComplete="name" aria-invalid={Boolean(errors.name)} required />
        </Field>
        <Field id="pilot-email" label="Work email" error={errors.email}>
          <Input id="pilot-email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} required />
        </Field>
        <Field id="pilot-phone" label="Phone" error={errors.phone}>
          <Input id="pilot-phone" name="phone" type="tel" autoComplete="tel" placeholder="0803 123 4567" aria-invalid={Boolean(errors.phone)} required />
        </Field>
        <Field id="pilot-estate" label="Estate name" error={errors.estateName}>
          <Input id="pilot-estate" name="estateName" aria-invalid={Boolean(errors.estateName)} required />
        </Field>
        <Field id="pilot-city" label="City" error={errors.city}>
          <Input id="pilot-city" name="city" placeholder="Ibadan" aria-invalid={Boolean(errors.city)} required />
        </Field>
        <Field id="pilot-units" label="Number of units" error={errors.units}>
          <Input id="pilot-units" name="units" type="number" inputMode="numeric" min={5} aria-invalid={Boolean(errors.units)} required />
        </Field>
      </div>
      <Field id="pilot-message" label="Anything we should know?" optional>
        <Textarea id="pilot-message" name="message" rows={3} maxLength={1000} />
      </Field>
      <div className="hidden" aria-hidden>
        <label htmlFor="pilot-website">Website</label>
        <input id="pilot-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" size="lg" pending={pending} pendingLabel="Sending request…">
        Book a pilot walkthrough
      </Button>
      <p className="caption-2 text-muted">We use these details only to arrange your pilot. See our privacy notice.</p>
    </form>
  );
}
