"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { useMutation } from "@/components/ui/use-mutation";
import { api } from "@/lib/api/client";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { GRANTABLE_PERMISSIONS, ROLES, type EstateMember, type Gate, type GrantablePermission, type Role } from "@/types/domain";

const PERMISSION_LABELS: Record<GrantablePermission, string> = {
  "ledger.approve": "Approve ledger entries",
  "ledger.publish": "Publish ledger entries",
  "billingRule.approve": "Approve billing charges",
};

export function MemberDialog({
  member,
  units,
  gates,
  isSelf,
}: {
  member: Pick<EstateMember, "id" | "displayName" | "role" | "status" | "gateIds" | "permissions" | "unitId">;
  units: { id: string; label: string }[];
  gates: Gate[];
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(member.role);
  const mutation = useMutation((body: Record<string, unknown>) => api(`/api/members/${member.id}`, { method: "PATCH", json: body }), {
    onSuccess: () => setOpen(false),
  });
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Manage
      </Button>
      <Dialog open={open} onClose={() => !mutation.pending && setOpen(false)} title={`Manage ${member.displayName}`} description="Changing a role or suspending a member signs them out of every device.">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={submitWith((form) => {
            const body: Record<string, unknown> = {};
            if (!isSelf) {
              body.role = role;
              body.status = text(form, "status");
            }
            if (role === "resident") body.unitId = text(form, "unitId") || null;
            if (role === "guard") body.gateIds = form.getAll("gateIds").map(String);
            if (role === "exco") body.permissions = form.getAll("permissions").map(String);
            void mutation.run(body);
          })}
        >
          {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
          {isSelf && <Notice tone="info">You cannot change your own role or status.</Notice>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="member-role" label="Role">
              <Select id="member-role" value={role} disabled={isSelf} onChange={(event) => setRole(event.target.value as Role)}>
                {ROLES.map((value) => (
                  <option key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="member-status" label="Status">
              <Select id="member-status" name="status" defaultValue={member.status === "suspended" ? "suspended" : "active"} disabled={isSelf}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
            </Field>
          </div>
          {role === "resident" && (
            <Field id="member-unit" label="Unit">
              <Select id="member-unit" name="unitId" defaultValue={member.unitId ?? units[0]?.id}>
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
              <legend className="title-4">Assigned gates</legend>
              <div className="flex flex-wrap gap-2">
                {gates.map((gate) => (
                  <label key={gate.id} className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 py-2 body-5 has-[:checked]:border-violet has-[:checked]:bg-violet-soft">
                    <input type="checkbox" name="gateIds" value={gate.id} defaultChecked={member.gateIds.includes(gate.id)} className="size-4 accent-violet" />
                    {gate.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {role === "exco" && (
            <fieldset className="flex flex-col gap-2">
              <legend className="title-4">Exco permissions</legend>
              {GRANTABLE_PERMISSIONS.map((permission) => (
                <label key={permission} className="flex min-h-12 items-center gap-3 body-5">
                  <input type="checkbox" name="permissions" value={permission} defaultChecked={member.permissions.includes(permission)} className="size-5 accent-violet" />
                  {PERMISSION_LABELS[permission]}
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={mutation.pending}>
              Cancel
            </Button>
            <Button type="submit" pending={mutation.pending} pendingLabel="Saving…">
              Save member
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
