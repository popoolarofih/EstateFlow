"use client";

import { Checks } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/components/ui/use-mutation";
import { api } from "@/lib/api/client";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const mutation = useMutation(() => api("/api/notifications/read", { json: {} }));
  return (
    <Button variant="secondary" size="sm" icon={<Checks size={18} aria-hidden />} pending={mutation.pending} pendingLabel="Saving…" disabled={disabled} onClick={() => mutation.run()}>
      Mark all as read
    </Button>
  );
}
