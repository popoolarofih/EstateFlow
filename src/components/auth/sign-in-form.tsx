"use client";

import { EnvelopeSimple, Phone } from "@/components/ui/icons";
import {
  RecaptchaVerifier,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { describedBy, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith } from "@/components/ui/forms";
import { useHydrated } from "@/components/ui/use-hydrated";
import { authErrorMessage, establishSession } from "@/lib/auth/client-session";
import { clientAuth } from "@/lib/firebase/client";
import { normalizeNigerianPhone } from "@/lib/validation/common";

type Mode = "email" | "phone" | "reset";

export function SignInForm() {
  const router = useRouter();
  // Until React hydrates, submitting would be a plain HTML form post; never allow that.
  const hydrated = useHydrated();
  const [mode, setMode] = useState<Mode>("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  async function finish(user: Parameters<typeof establishSession>[0]) {
    // Read at submit time (not useSearchParams) so the form can be part of the static shell.
    const next = new URLSearchParams(window.location.search).get("next");
    const redirectTo = await establishSession(user, next);
    router.replace(redirectTo);
    router.refresh();
  }

  async function run(task: () => Promise<void>) {
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      await task();
    } catch (caught) {
      setError(authErrorMessage(caught));
      setPending(false);
    }
  }

  function onEmailSubmit(form: FormData) {
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    void run(async () => {
      const credential = await signInWithEmailAndPassword(clientAuth(), email, password);
      await finish(credential.user);
    });
  }

  function onPhoneSubmit(form: FormData) {
    if (confirmation) {
      const code = String(form.get("otp") ?? "").trim();
      if (!/^\d{6}$/.test(code)) return setError("Enter the six digit code from the SMS.");
      void run(async () => {
        const credential = await confirmation.confirm(code);
        await finish(credential.user);
      });
      return;
    }
    const phone = normalizeNigerianPhone(String(form.get("phone") ?? ""));
    if (!phone) return setError("Enter a valid Nigerian phone number, for example 0803 123 4567.");
    void run(async () => {
      verifierRef.current ??= new RecaptchaVerifier(clientAuth(), recaptchaRef.current!, { size: "invisible" });
      setConfirmation(await signInWithPhoneNumber(clientAuth(), phone, verifierRef.current));
      setInfo(`We sent a six digit code to ${phone}.`);
      setPending(false);
    });
  }

  function onResetSubmit(form: FormData) {
    const email = String(form.get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    void run(async () => {
      await sendPasswordResetEmail(clientAuth(), email).catch((caught) => {
        // Do not reveal whether an account exists for this email.
        if ((caught as { code?: string }).code !== "auth/user-not-found") throw caught;
      });
      setInfo("If an account exists for that email, a reset link is on its way.");
      setPending(false);
    });
  }

  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "email", label: "Email", icon: <EnvelopeSimple size={18} aria-hidden /> },
    { id: "phone", label: "Phone", icon: <Phone size={18} aria-hidden /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      {mode !== "reset" && (
        <div role="tablist" aria-label="Sign in method" className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={mode === tab.id}
              onClick={() => {
                setMode(tab.id);
                setError(null);
                setInfo(null);
              }}
              className={cx(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg button-sm transition duration-300 ease-weighted",
                mode === tab.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {info && <Notice tone="success">{info}</Notice>}

      {mode === "email" && (
        <form method="post" onSubmit={submitWith(onEmailSubmit)} className="flex flex-col gap-4" noValidate>
          <Field id="email" label="Email">
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </Field>
          <Field id="password" label="Password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Button type="submit" disabled={!hydrated} pending={pending} pendingLabel="Signing in…">
            Sign in
          </Button>
          <button
            type="button"
            className="self-start rounded-md button-sm text-violet-ink underline underline-offset-4"
            onClick={() => {
              setMode("reset");
              setError(null);
              setInfo(null);
            }}
          >
            Forgot your password?
          </button>
        </form>
      )}

      {mode === "phone" && (
        <form
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            onPhoneSubmit(new FormData(event.currentTarget));
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          {!confirmation ? (
            <Field id="phone" label="Phone number" hint="We will text you a six digit code.">
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="0803 123 4567"
                aria-describedby={describedBy("phone", "hint")}
                required
              />
            </Field>
          ) : (
            <Field id="otp" label="Verification code">
              <Input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
            </Field>
          )}
          <Button type="submit" disabled={!hydrated} pending={pending} pendingLabel={confirmation ? "Verifying…" : "Sending code…"}>
            {confirmation ? "Verify and sign in" : "Send code"}
          </Button>
          <div ref={recaptchaRef} />
        </form>
      )}

      {mode === "reset" && (
        <form method="post" onSubmit={submitWith(onResetSubmit)} className="flex flex-col gap-4" noValidate>
          <Field id="reset-email" label="Email" hint="We will send a link to choose a new password.">
            <Input id="reset-email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" disabled={!hydrated} pending={pending} pendingLabel="Sending link…">
            Send reset link
          </Button>
          <button
            type="button"
            className="self-start rounded-md button-sm text-violet-ink underline underline-offset-4"
            onClick={() => setMode("email")}
          >
            Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
