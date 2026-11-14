"use client";

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { api, errorMessage } from "@/lib/api/client";
import { authErrorMessage, establishSession } from "@/lib/auth/client-session";
import { clientAuth } from "@/lib/firebase/client";

/** Create an account (or sign in) and accept the invitation in one flow. */
export function JoinForm({ token, displayName, signedIn }: { token: string; displayName: string; signedIn: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    const { redirectTo } = await api<{ redirectTo: string }>("/api/invites/accept", { json: { token } });
    router.replace(redirectTo);
    router.refresh();
  }

  async function run(task: () => Promise<void>, firebaseStep: boolean) {
    setPending(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(firebaseStep && (caught as { code?: string }).code ? authErrorMessage(caught) : errorMessage(caught));
      setPending(false);
    }
  }

  if (signedIn) {
    return (
      <div className="flex flex-col gap-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Button pending={pending} pendingLabel="Joining…" onClick={() => run(accept, false)}>
          Accept invitation
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={submitWith((form) => {
        const name = text(form, "name");
        const email = text(form, "email");
        const password = String(form.get("password") ?? "");
        if (mode === "create" && name.length < 2) return setError("Enter your full name.");
        if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter the email address the invitation was sent to.");
        if (password.length < 8) return setError("Use a password with at least 8 characters.");
        void run(async () => {
          const auth = clientAuth();
          const credential =
            mode === "create"
              ? await createUserWithEmailAndPassword(auth, email, password)
              : await signInWithEmailAndPassword(auth, email, password);
          if (mode === "create") await updateProfile(credential.user, { displayName: name });
          await establishSession(credential.user);
          await accept();
        }, true);
      })}
    >
      {error && <Notice tone="error">{error}</Notice>}
      {mode === "create" && (
        <Field id="name" label="Full name">
          <Input id="name" name="name" autoComplete="name" defaultValue={displayName} required />
        </Field>
      )}
      <Field id="email" label="Email" hint="Use the address your estate manager invited.">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field id="password" label={mode === "create" ? "Choose a password" : "Password"} hint={mode === "create" ? "At least 8 characters." : undefined}>
        <Input id="password" name="password" type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} required />
      </Field>
      <Button type="submit" pending={pending} pendingLabel="Setting up your account…">
        {mode === "create" ? "Create account and join" : "Sign in and join"}
      </Button>
      <button
        type="button"
        className="self-start rounded-md button-sm text-violet-ink underline underline-offset-4"
        onClick={() => setMode(mode === "create" ? "signin" : "create")}
      >
        {mode === "create" ? "I already have an EstateFlow account" : "I need to create an account"}
      </button>
    </form>
  );
}
