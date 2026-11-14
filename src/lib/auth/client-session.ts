"use client";

import { signOut, type User } from "firebase/auth";
import { api } from "@/lib/api/client";
import { clientAuth } from "@/lib/firebase/client";

/** Exchanges the fresh Firebase sign in for the server session cookie. */
export async function establishSession(user: User, next?: string | null): Promise<string> {
  const idToken = await user.getIdToken(true);
  const { redirectTo } = await api<{ redirectTo: string }>("/api/auth/session", {
    json: { idToken, next: next ?? undefined },
  });
  return redirectTo;
}

export async function signOutEverywhere(): Promise<void> {
  try {
    await api("/api/auth/session", { method: "DELETE" });
  } finally {
    await signOut(clientAuth()).catch(() => undefined);
  }
}

/** Maps Firebase Auth error codes to plain language. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "That email and password do not match. Try again or reset your password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes before trying again.";
    case "auth/email-already-in-use":
      return "An account already uses this email. Sign in instead.";
    case "auth/weak-password":
      return "Use a password with at least 8 characters.";
    case "auth/invalid-phone-number":
      return "Enter a valid phone number, for example 0803 123 4567.";
    case "auth/invalid-verification-code":
      return "That code is not correct. Check the SMS and try again.";
    case "auth/code-expired":
      return "That code has expired. Request a new one.";
    case "auth/network-request-failed":
      return "You appear to be offline. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your estate manager.";
    default:
      return (error as Error)?.message && !code ? (error as Error).message : "Sign in failed. Please try again.";
  }
}
