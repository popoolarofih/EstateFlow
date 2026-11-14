"use client";

import { Plus, Trash } from "@/components/ui/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { useMutation } from "@/components/ui/use-mutation";
import { api } from "@/lib/api/client";
import { CopyLink } from "./invite-dialog";

interface Created {
  estateId: string;
  invite: { link: string; displayName: string };
}

export function CreateEstateForm() {
  const [gates, setGates] = useState([{ key: 0, id: "main_gate", name: "Main gate" }]);
  const [created, setCreated] = useState<Created | null>(null);
  const mutation = useMutation((body: Record<string, unknown>) => api<Created>("/api/estates", { json: body }), { onSuccess: setCreated });

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success" title="Estate created">
          Send this one time link to {created.invite.displayName}, the first facility manager. It is shown only now.
        </Notice>
        <CopyLink link={created.invite.link} />
        <Button variant="secondary" onClick={() => setCreated(null)}>
          Create another estate
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={submitWith((form) =>
        mutation.run({
          name: text(form, "name"),
          slug: text(form, "slug"),
          address: text(form, "address"),
          city: text(form, "city"),
          state: text(form, "state"),
          planId: text(form, "planId"),
          timezone: "Africa/Lagos",
          gates: gates.map(({ id, name }) => ({ id: id.trim(), name: name.trim() })),
          managerName: text(form, "managerName"),
          managerEmail: text(form, "managerEmail"),
        }),
      )}
    >
      {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="name" label="Estate name" error={mutation.fieldError("name")}>
          <Input id="name" name="name" required />
        </Field>
        <Field id="slug" label="Short id" hint="Lowercase letters, numbers and underscores." error={mutation.fieldError("slug")}>
          <Input id="slug" name="slug" required />
        </Field>
        <Field id="address" label="Address" error={mutation.fieldError("address")}>
          <Input id="address" name="address" required />
        </Field>
        <Field id="city" label="City" error={mutation.fieldError("city")}>
          <Input id="city" name="city" required />
        </Field>
        <Field id="state" label="State" error={mutation.fieldError("state")}>
          <Input id="state" name="state" required />
        </Field>
        <Field id="planId" label="Plan">
          <Select id="planId" name="planId" defaultValue="pilot">
            <option value="pilot">Pilot</option>
            <option value="standard">Standard</option>
          </Select>
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="title-4">Gates</legend>
        {gates.map((gate, index) => (
          <div key={gate.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field id={`gate-name-${gate.key}`} label="Name">
              <Input id={`gate-name-${gate.key}`} value={gate.name} onChange={(event) => setGates(gates.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))} />
            </Field>
            <Field id={`gate-id-${gate.key}`} label="Id">
              <Input id={`gate-id-${gate.key}`} value={gate.id} onChange={(event) => setGates(gates.map((item, i) => (i === index ? { ...item, id: event.target.value.toLowerCase() } : item)))} />
            </Field>
            <Button variant="ghost" size="sm" disabled={gates.length === 1} aria-label="Remove gate" icon={<Trash size={16} aria-hidden />} onClick={() => setGates(gates.filter((_, i) => i !== index))}>
              <span className="sr-only">Remove</span>
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" className="self-start" icon={<Plus size={16} aria-hidden />} onClick={() => setGates([...gates, { key: Date.now(), id: "", name: "" }])}>
          Add gate
        </Button>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="managerName" label="First manager name" error={mutation.fieldError("managerName")}>
          <Input id="managerName" name="managerName" required />
        </Field>
        <Field id="managerEmail" label="First manager email" error={mutation.fieldError("managerEmail")}>
          <Input id="managerEmail" name="managerEmail" type="email" required />
        </Field>
      </div>
      <Button type="submit" className="self-end" pending={mutation.pending} pendingLabel="Creating…">
        Create estate
      </Button>
    </form>
  );
}
