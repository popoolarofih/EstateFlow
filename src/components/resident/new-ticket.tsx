"use client";

import { Plus } from "@/components/ui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith } from "@/components/ui/forms";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import { compressFormImages } from "@/lib/images/compress";
import { PRIORITY_LABELS } from "@/lib/maintenance/workflow";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/types/domain";

const CATEGORY_LABELS: Record<(typeof TICKET_CATEGORIES)[number], string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  security: "Security",
  waste: "Waste collection",
  roads: "Roads and drainage",
  generator: "Generator",
  water: "Water supply",
  other: "Other",
};

export function NewTicket() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  return (
    <>
      <Button icon={<Plus size={20} aria-hidden />} onClick={() => setOpen(true)}>
        Report an issue
      </Button>
      <Dialog open={open} onClose={() => !pending && setOpen(false)} title="Report a maintenance issue" description="Your facility manager will triage it and keep you updated here.">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={submitWith(async (form) => {
            const photos = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
            if (photos.length > 4) return setError("Attach at most 4 photos.");
            setPending(true);
            setError(null);
            setFieldErrors({});
            try {
              const { id } = await api<{ id: string }>("/api/maintenance", { formData: await compressFormImages(form, "photos") });
              setOpen(false);
              router.push(`/resident/services/${id}`);
            } catch (caught) {
              setError(errorMessage(caught));
              if (caught instanceof ApiError) setFieldErrors(caught.fieldErrors);
            } finally {
              setPending(false);
            }
          })}
        >
          {error && <Notice tone="error">{error}</Notice>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="category" label="Category">
              <Select id="category" name="category" defaultValue="plumbing">
                {TICKET_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="priority" label="How urgent?">
              <Select id="priority" name="priority" defaultValue="normal">
                {TICKET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field id="title" label="Short title" error={fieldErrors.title?.[0]}>
            <Input id="title" name="title" maxLength={80} placeholder="Burst pipe behind kitchen" required />
          </Field>
          <Field id="description" label="What is happening?" error={fieldErrors.description?.[0]}>
            <Textarea id="description" name="description" rows={4} maxLength={2000} required />
          </Field>
          <Field id="photos" label="Photos" optional hint="Up to 4 images. Large photos are resized before upload.">
            <input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="body-6 file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-canvas file:px-3 file:py-2 file:button-sm" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" pending={pending} pendingLabel="Sending…">
              Send request
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export { CATEGORY_LABELS };
