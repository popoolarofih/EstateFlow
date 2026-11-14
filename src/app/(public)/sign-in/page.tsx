import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { ListSkeleton } from "@/components/ui/feedback";
import { getActiveContext } from "@/lib/auth/authorize";
import { roleHome } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

async function RedirectIfSignedIn() {
  const user = await getSessionUser();
  if (user) {
    const context = await getActiveContext();
    if (context) redirect(roleHome(context.member.role));
    if (user.platformAdmin) redirect("/platform");
  }
  return <SignInForm />;
}

export default function SignInPage() {
  return (
    <AuthShell title="Sign in to EstateFlow" description="Residents, gate security and estate managers all sign in here.">
      <Suspense fallback={<ListSkeleton rows={2} label="Loading sign in" />}>
        <RedirectIfSignedIn />
      </Suspense>
    </AuthShell>
  );
}
