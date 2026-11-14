"use client";

import { PencilSimple, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { useMutation } from "@/components/ui/use-mutation";
import { api } from "@/lib/api/client";
import type { Unit } from "@/types/domain";

type UnitInput = { label: string; block: string; floor: string; occupancyStatus: "occupied" | "vacant" };

export function UnitDialog({ unit }: { unit?: Pick<Unit, "id" | "label" | "block" | "floor" | "occupancyStatus"> }) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation(
    (input: UnitInput) => (unit ? api(`/api/units/${unit.id}`, { method: "PATCH", json: input }) : api("/api/units", { json: input })),
    { onSuccess: () => setOpen(false) },
  );
  return (
    <>
      {unit ? (
        <Button variant="ghost" size="sm" icon={<PencilSimple size={16} aria-hidden />} onClick={() => setOpen(true)} aria-label={`Edit unit ${unit.label}`}>
          Edit
        </Button>
      ) : (
        <Button icon={<Plus size={20} aria-hidden />} onClick={() => setOpen(true)}>
          Add unit
        </Button>
      )}
      <Dialog open={open} onClose={() => !mutation.pending && setOpen(false)} title={unit ? `Edit unit ${unit.label}` : "Add a unit"}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={submitWith((form) =>
            mutation.run({
              label: text(form, "label"),
              block: text(form, "block"),
              floor: text(form, "floor"),
              occupancyStatus: text(form, "occupancyStatus") as UnitInput["occupancyStatus"],
            }),
          )}
        >
          {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
          <Field id="label" label="Unit label" hint="For example 14B or Flat 3." error={mutation.fieldError("label")}>
            <Input id="label" name="label" defaultValue={unit?.label} required maxLength={40} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="block" label="Block or street" optional>
              <Input id="block" name="block" defaultValue={unit?.block ?? ""} maxLength={40} />
            </Field>
            <Field id="floor" label="Floor" optional>
              <Input id="floor" name="floor" defaultValue={unit?.floor ?? ""} maxLength={20} />
            </Field>
          </div>
          <Field id="occupancyStatus" label="Occupancy">
            <Select id="occupancyStatus" name="occupancyStatus" defaultValue={unit?.occupancyStatus ?? "vacant"}>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={mutation.pending}>
              Cancel
            </Button>
            <Button type="submit" pending={mutation.pending} pendingLabel="Saving…">
              {unit ? "Save changes" : "Add unit"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
