"use client";

import { Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import { compressImage } from "@/lib/images/compress";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/ledger/ledger";
import { formatNaira, parseNairaToKobo } from "@/lib/money";

export function LedgerEntryDialog({ dualApprovalThresholdKobo }: { dualApprovalThresholdKobo: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Button icon={<Plus size={20} aria-hidden />} onClick={() => setOpen(true)}>
        Record entry
      </Button>
      <Dialog open={open} onClose={() => !pending && setOpen(false)} title="Record a ledger entry" description="Entries start as drafts. Exco approves and publishes them to residents.">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={submitWith(async (form) => {
            const amountKobo = parseNairaToKobo(text(form, "amount"));
            if (!amountKobo) return setError("Enter an amount in naira, for example 185000.");
            const evidence = form.getAll("evidence").filter((value): value is File => value instanceof File && value.size > 0);
            if (type === "expense" && evidence.length === 0) return setError("Attach the invoice, receipt or other evidence for this expense.");
            const body = new FormData();
            body.set("type", type);
            body.set("category", text(form, "category"));
            body.set("vendor", text(form, "vendor"));
            body.set("description", text(form, "description"));
            body.set("amountKobo", String(amountKobo));
            body.set("transactionDate", text(form, "transactionDate"));
            // Photos of receipts are compressed; PDFs pass through unchanged.
            for (const file of evidence) body.append("evidence", await compressImage(file, { maxDimension: 2000, quality: 0.85 }));
            setPending(true);
            setError(null);
            setFieldErrors({});
            try {
              await api("/api/ledger", { formData: body });
              setOpen(false);
              router.refresh();
            } catch (caught) {
              setError(errorMessage(caught));
              if (caught instanceof ApiError) setFieldErrors(caught.fieldErrors);
            } finally {
              setPending(false);
            }
          })}
        >
          {error && <Notice tone="error">{error}</Notice>}
          <div className="grid grid-cols-2 gap-3">
            <Field id="type" label="Type">
              <Select id="type" value={type} onChange={(event) => setType(event.target.value as "expense" | "income")}>
                <option value="expense">Expense</option>
                <option value="income">Other income</option>
              </Select>
            </Field>
            <Field id="category" label="Category">
              <Select id="category" name="category" key={type}>
                {(type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field id="vendor" label="Vendor" optional={type === "income"} error={fieldErrors.vendor?.[0]}>
            <Input id="vendor" name="vendor" maxLength={80} placeholder="Who was paid" />
          </Field>
          <Field id="description" label="Description" error={fieldErrors.description?.[0]}>
            <Textarea id="description" name="description" rows={2} maxLength={300} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="amount" label="Amount (₦)" hint={dualApprovalThresholdKobo > 0 ? `From ${formatNaira(dualApprovalThresholdKobo)} two approvers are needed.` : undefined}>
              <Input id="amount" name="amount" inputMode="decimal" required />
            </Field>
            <Field id="transactionDate" label="Date">
              <Input id="transactionDate" name="transactionDate" type="date" defaultValue={today} max={today} required />
            </Field>
          </div>
          <Field id="evidence" label="Evidence" optional={type === "income"} hint="Invoice, receipt or bank slip. Images or PDF, up to 10 MB each, 5 files.">
            <input id="evidence" name="evidence" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" multiple className="body-6 file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-canvas file:px-3 file:py-2 file:button-sm" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" pending={pending} pendingLabel="Uploading…">
              Save draft
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function LedgerRowActions({
  entryId,
  description,
  canApprove,
  canPublish,
  canReverse,
  canDiscard,
}: {
  entryId: string;
  description: string;
  canApprove: boolean;
  canPublish: boolean;
  canReverse: boolean;
  canDiscard: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const call = (path: string, init?: Parameters<typeof api>[1]) => async () => {
    try {
      await api(path, init ?? { method: "POST" });
      router.refresh();
    } catch (error) {
      return errorMessage(error);
    }
  };
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canApprove && (
        <ConfirmButton label="Approve" variant="primary" title="Approve this entry?" description={description} confirmLabel="Approve" onConfirm={call(`/api/ledger/${entryId}/approve`)} />
      )}
      {canPublish && (
        <ConfirmButton label="Publish" variant="primary" title="Publish to residents?" description="Published entries are visible to every resident and can never be edited or deleted. Mistakes are corrected with a reversal." confirmLabel="Publish entry" onConfirm={call(`/api/ledger/${entryId}/publish`)} />
      )}
      {canReverse && (
        <ConfirmButton
          label="Reverse"
          title="Draft a reversal?"
          description="Creates a linked correcting entry. It goes through approval and publishing like any other entry."
          confirmLabel="Draft reversal"
          onConfirm={async () => {
            if (reason.trim().length < 5) return "Explain why this entry is being reversed.";
            return call(`/api/ledger/${entryId}/reverse`, { json: { reason } })();
          }}
        >
          <Field id={`reverse-${entryId}`} label="Reason">
            <Textarea id={`reverse-${entryId}`} rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </ConfirmButton>
      )}
      {canDiscard && (
        <ConfirmButton label="Discard" danger title="Discard this draft?" description="The draft and its evidence files are deleted. This is recorded in the audit log." confirmLabel="Discard draft" onConfirm={call(`/api/ledger/${entryId}`, { method: "DELETE" })} />
      )}
    </div>
  );
}
