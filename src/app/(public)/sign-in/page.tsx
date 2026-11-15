import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getActiveContext } from "@/lib/auth/authorize";
import { roleHome } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/** Sends people who are already signed in to their home screen; renders nothing otherwise. */
async function RedirectIfSignedIn() {
  const user = await getSessionUser();
  if (user) {
    const context = await getActiveContext();
    if (context) redirect(roleHome(context.member.role));
    if (user.platformAdmin) redirect("/platform");
  }
  return null;
}

export default function SignInPage() {
  return (
    <AuthShell title="Sign in to EstateFlow" description="Residents, gate security and estate managers all sign in here.">
      {/* The form is in the static shell, so it appears instantly and never waits on the server. */}
      <SignInForm />
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
    </AuthShell>
  );
}
