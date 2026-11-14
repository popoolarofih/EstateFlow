"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { api, errorMessage } from "@/lib/api/client";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/maintenance/workflow";
import { TICKET_PRIORITIES, type TicketPriority, type TicketStatus } from "@/types/domain";

export function CommentForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={submitWith(async (form, element) => {
        const body = text(form, "body");
        if (!body) return setError("Write a comment first.");
        setPending(true);
        setError(null);
        try {
          await api(`/api/maintenance/${ticketId}/comments`, { json: { body } });
          element.reset();
          router.refresh();
        } catch (caught) {
          setError(errorMessage(caught));
        } finally {
          setPending(false);
        }
      })}
    >
      <Field id="comment" label="Add a comment" error={error ?? undefined}>
        <Textarea id="comment" name="body" rows={3} maxLength={1000} />
      </Field>
      <Button type="submit" variant="secondary" pending={pending} pendingLabel="Posting…" className="self-end">
        Post comment
      </Button>
    </form>
  );
}

/** Resident controls: confirm a fix or reopen within the estate's reopen window. */
export function OwnerTicketActions({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState<TicketStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (status !== "resolved" && status !== "closed") return null;
  async function move(to: TicketStatus) {
    setPending(to);
    setError(null);
    try {
      await api(`/api/maintenance/${ticketId}/transition`, { json: { to } });
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        {status === "resolved" && (
          <Button pending={pending === "closed"} pendingLabel="Saving…" onClick={() => move("closed")}>
            Confirm it is fixed
          </Button>
        )}
        <Button variant="secondary" pending={pending === "triaged"} pendingLabel="Reopening…" onClick={() => move("triaged")}>
          It is not fixed, reopen
        </Button>
      </div>
    </div>
  );
}

/** Manager workflow controls; the server enforces the same transition table. */
export function ManagerTicketActions({
  ticketId,
  nextStatuses,
  managers,
  priority,
}: {
  ticketId: string;
  nextStatuses: readonly TicketStatus[];
  managers: { uid: string; name: string }[];
  priority: TicketPriority;
}) {
  const router = useRouter();
  const [to, setTo] = useState<TicketStatus | "">(nextStatuses[0] ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (nextStatuses.length === 0) return null;
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={submitWith(async (form) => {
        if (!to) return;
        setPending(true);
        setError(null);
        try {
          await api(`/api/maintenance/${ticketId}/transition`, {
            json: {
              to,
              assigneeUid: to === "assigned" ? text(form, "assignee") || null : undefined,
              resolutionNotes: to === "resolved" || to === "closed" ? text(form, "notes") || null : undefined,
              priority: (text(form, "priority") || undefined) as TicketPriority | undefined,
            },
          });
          router.refresh();
        } catch (caught) {
          setError(errorMessage(caught));
        } finally {
          setPending(false);
        }
      })}
    >
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="to" label="Move to">
          <Select id="to" value={to} onChange={(event) => setTo(event.target.value as TicketStatus)}>
            {nextStatuses.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="priority" label="Priority">
          <Select id="priority" name="priority" defaultValue={priority}>
            {TICKET_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {to === "assigned" && (
        <Field id="assignee" label="Assign to">
          <Select id="assignee" name="assignee" defaultValue={managers[0]?.uid}>
            {managers.map((manager) => (
              <option key={manager.uid} value={manager.uid}>
                {manager.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {(to === "resolved" || to === "closed") && (
        <Field id="notes" label={to === "resolved" ? "Resolution notes" : "Closing note"} optional={to === "closed"}>
          <Textarea id="notes" name="notes" rows={3} maxLength={1000} />
        </Field>
      )}
      <Button type="submit" pending={pending} pendingLabel="Updating…" className="self-end">
        Update ticket
      </Button>
    </form>
  );
}
