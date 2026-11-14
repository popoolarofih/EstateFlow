"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { api, errorMessage } from "@/lib/api/client";

export function RevokeInviteButton({ inviteId, name }: { inviteId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Revoke"
      title={`Revoke the invitation for ${name}?`}
      description="The link stops working immediately. You can send a new invitation later."
      confirmLabel="Revoke invitation"
      danger
      onConfirm={async () => {
        try {
          await api(`/api/invites/${inviteId}/revoke`, { method: "POST" });
          router.refresh();
        } catch (error) {
          return errorMessage(error);
        }
      }}
    />
  );
}
