import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { JoinForm } from "@/components/auth/join-form";
import { ListSkeleton, Notice } from "@/components/ui/feedback";
import { getSessionUser } from "@/lib/auth/session";
import { previewInvite } from "@/server/services/members";

export const metadata: Metadata = { title: "Join your estate", robots: { index: false, follow: false } };

async function Invitation({ params }: { params: Promise<{ inviteToken: string }> }) {
  const { inviteToken } = await params;
  const [preview, user] = await Promise.all([previewInvite(inviteToken), getSessionUser()]);
  if (!preview || preview.status === "revoked") {
    return <Notice tone="error" title="This invitation link is not valid">Ask your estate manager to send a new invitation.</Notice>;
  }
  if (preview.status === "accepted") {
    return (
      <Notice tone="info" title="This invitation has already been used">
        <Link href="/sign-in" className="underline underline-offset-4">Sign in</Link> to continue.
      </Notice>
    );
  }
  if (preview.expired) {
    return <Notice tone="warning" title="This invitation has expired">Ask your estate manager for a new invitation.</Notice>;
  }
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-3 rounded-2xl bg-canvas p-4">
        <div className="flex justify-between gap-4">
          <dt className="caption-2 text-muted">Estate</dt>
          <dd className="body-5 text-ink text-right">{preview.estateName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="caption-2 text-muted">Role</dt>
          <dd className="body-5 text-ink text-right">{preview.roleLabel}</dd>
        </div>
        {preview.maskedEmail && (
          <div className="flex justify-between gap-4">
            <dt className="caption-2 text-muted">Invited email</dt>
            <dd className="body-5 text-ink text-right">{preview.maskedEmail}</dd>
          </div>
        )}
      </dl>
      <JoinForm token={inviteToken} displayName={preview.displayName} signedIn={Boolean(user)} />
    </div>
  );
}

export default function JoinPage({ params }: PageProps<"/join/[inviteToken]">) {
  return (
    <AuthShell title="Join your estate on EstateFlow" description="Your estate manager invited you. Set up your account to continue.">
      <Suspense fallback={<ListSkeleton rows={2} label="Checking invitation" />}>
        <Invitation params={params} />
      </Suspense>
    </AuthShell>
  );
}
