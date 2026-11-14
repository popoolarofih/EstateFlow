"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Textarea } from "@/components/ui/field";
import { api, errorMessage } from "@/lib/api/client";

export function ResolveEmergencyButton({ alertId, unitLabel }: { alertId: string; unitLabel: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  return (
    <ConfirmButton
      label="Resolve"
      variant="primary"
      title={`Resolve the alert for ${unitLabel}?`}
      description="The resident is notified. Your notes are kept in the audit log."
      confirmLabel="Mark resolved"
      onConfirm={async () => {
        if (notes.trim().length < 3) return "Add a short note on how this was resolved.";
        try {
          await api(`/api/emergencies/${alertId}/resolve`, { json: { resolutionNotes: notes } });
          router.refresh();
        } catch (error) {
          return errorMessage(error);
        }
      }}
    >
      <Field id={`resolve-${alertId}`} label="Resolution notes">
        <Textarea id={`resolve-${alertId}`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} />
      </Field>
    </ConfirmButton>
  );
}
