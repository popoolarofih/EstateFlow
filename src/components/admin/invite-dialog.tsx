"use client";

import { Copy, UserPlus } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { useMutation } from "@/components/ui/use-mutation";
import { api } from "@/lib/api/client";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { ROLES, type Gate, type Role } from "@/types/domain";

interface CreatedInvite {
  id: string;
  link: string;
  displayName: string;
}

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-canvas p-3">
      <code className="break-all font-mono caption-2 text-ink">{link}</code>
      <Button
        variant="secondary"
        size="sm"
        icon={<Copy size={16} aria-hidden />}
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

export function InviteDialog({ units, gates }: { units: { id: string; label: string }[]; gates: Gate[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("resident");
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const mutation = useMutation((input: Record<string, unknown>) => api<CreatedInvite>("/api/invites", { json: input }), {
    onSuccess: (result) => setCreated(result),
  });

  function close() {
    if (mutation.pending) return;
    setOpen(false);
    setCreated(null);
    mutation.reset();
  }

  return (
    <>
      <Button variant="dark" icon={<UserPlus size={20} aria-hidden />} onClick={() => setOpen(true)}>
        Invite member
      </Button>
      <Dialog open={open} onClose={close} title={created ? `Invitation for ${created.displayName}` : "Invite a member"} description={created ? "Share this link with them. It works once and expires in 14 days. It is shown only now." : "Residents, guards, managers and Exco join through a one time link."}>
        {created ? (
          <div className="flex flex-col gap-4">
            <CopyLink link={created.link} />
            <Button onClick={close}>Done</Button>
          </div>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={submitWith((form) =>
              mutation.run({
                displayName: text(form, "displayName"),
                email: text(form, "email"),
                phone: text(form, "phone") || undefined,
                role,
                unitId: role === "resident" ? text(form, "unitId") || null : null,
                gateIds: role === "guard" ? form.getAll("gateIds").map(String) : [],
              }),
            )}
          >
            {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
            <Field id="displayName" label="Full name" error={mutation.fieldError("displayName")}>
              <Input id="displayName" name="displayName" required maxLength={80} />
            </Field>
            <Field id="email" label="Email" hint="They must sign up with this email." error={mutation.fieldError("email")}>
              <Input id="email" name="email" type="email" />
            </Field>
            <Field id="phone" label="Phone" optional error={mutation.fieldError("phone")}>
              <Input id="phone" name="phone" type="tel" placeholder="0803 123 4567" />
            </Field>
            <Field id="role" label="Role">
              <Select id="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {ROLES.map((value) => (
                  <option key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
            {role === "resident" && (
              <Field id="unitId" label="Unit" error={mutation.fieldError("unitId")}>
                <Select id="unitId" name="unitId" required>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {role === "guard" && (
              <fieldset className="flex flex-col gap-2">
                <legend className="title-4">Gates</legend>
                <div className="flex flex-wrap gap-2">
                  {gates.map((gate, index) => (
                    <label key={gate.id} className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 py-2 body-5 has-[:checked]:border-violet has-[:checked]:bg-violet-soft">
                      <input type="checkbox" name="gateIds" value={gate.id} defaultChecked={index === 0} className="size-4 accent-violet" />
                      {gate.name}
                    </label>
                  ))}
                </div>
                {mutation.fieldError("gateIds") && <p className="caption-1 text-alert-ink">{mutation.fieldError("gateIds")}</p>}
              </fieldset>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={mutation.pending}>
                Cancel
              </Button>
              <Button type="submit" pending={mutation.pending} pendingLabel="Creating…">
                Create invitation
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
