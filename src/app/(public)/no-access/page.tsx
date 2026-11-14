import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "No estate access", robots: { index: false } };

export default function NoAccessPage() {
  return (
    <AuthShell
      title="You do not have access here yet"
      description="Your account is not an active member of an estate, or this page is not part of your role. Ask your estate manager for an invitation link."
    >
      <div className="flex flex-col gap-3">
        <LinkButton href="/sign-in" variant="primary">
          Go to my home screen
        </LinkButton>
        <SignOutButton />
      </div>
    </AuthShell>
  );
}
