"use client";

import { Lightning, Plus, Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { useMutation } from "@/components/ui/use-mutation";
import { api, errorMessage } from "@/lib/api/client";
import { formatNaira, parseNairaToKobo } from "@/lib/money";

export function BillingRuleDialog() {
  const [open, setOpen] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const mutation = useMutation((input: Record<string, unknown>) => api("/api/billing/rules", { json: input }), {
    onSuccess: () => setOpen(false),
  });
  return (
    <>
      <Button variant="secondary" icon={<Plus size={20} aria-hidden />} onClick={() => setOpen(true)}>
        New charge
      </Button>
      <Dialog open={open} onClose={() => !mutation.pending && setOpen(false)} title="Draft a recurring charge" description="An Exco member with approval rights must approve it before it is billed.">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={submitWith((form) => {
            const amountKobo = parseNairaToKobo(text(form, "amount"));
            if (!amountKobo) return setAmountError("Enter an amount in naira, for example 25000.");
            setAmountError(null);
            void mutation.run({
              name: text(form, "name"),
              description: text(form, "description"),
              frequency: text(form, "frequency"),
              amountKobo,
            });
          })}
        >
          {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
          <Field id="name" label="Charge name" hint="For example Service charge or Security levy." error={mutation.fieldError("name")}>
            <Input id="name" name="name" required maxLength={60} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="amount" label="Amount per unit (₦)" error={amountError ?? mutation.fieldError("amountKobo")}>
              <Input id="amount" name="amount" inputMode="decimal" placeholder="25000" required />
            </Field>
            <Field id="frequency" label="Billed">
              <Select id="frequency" name="frequency" defaultValue="monthly">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </Select>
            </Field>
          </div>
          <Field id="description" label="Notes" optional>
            <Textarea id="description" name="description" rows={2} maxLength={240} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={mutation.pending}>
              Cancel
            </Button>
            <Button type="submit" pending={mutation.pending} pendingLabel="Saving…">
              Save draft
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function RuleActions({ ruleId, name, canApprove, canArchive }: { ruleId: string; name: string; canApprove: boolean; canArchive: boolean }) {
  const router = useRouter();
  const act = (path: string) => async () => {
    try {
      await api(path, { method: "POST" });
      router.refresh();
    } catch (error) {
      return errorMessage(error);
    }
  };
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canApprove && (
        <ConfirmButton label="Approve" title={`Approve ${name}?`} description="Approved charges are added to every generated invoice for occupied units." confirmLabel="Approve charge" variant="primary" onConfirm={act(`/api/billing/rules/${ruleId}/approve`)} />
      )}
      {canArchive && (
        <ConfirmButton label="Archive" title={`Archive ${name}?`} description="It will no longer be billed. Existing invoices are not changed." confirmLabel="Archive charge" onConfirm={act(`/api/billing/rules/${ruleId}/archive`)} />
      )}
    </div>
  );
}

interface GenerationResult {
  periodKey: string;
  created: number;
  skippedExisting: number;
  unitsConsidered: number;
  totalKobo: number;
}

export function GenerateInvoicesButton() {
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<"monthly" | "quarterly">("monthly");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const mutation = useMutation(() => api<GenerationResult>("/api/billing/generate", { json: { frequency } }), { onSuccess: setResult });
  return (
    <>
      <Button icon={<Lightning size={20} aria-hidden />} onClick={() => setOpen(true)}>
        Generate invoices
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (mutation.pending) return;
          setOpen(false);
          setResult(null);
        }}
        title="Generate invoices for this period"
        description="Creates one invoice per occupied unit from approved charges. Running it again never creates duplicates."
      >
        {result ? (
          <Notice tone="success" title={`Period ${result.periodKey}`}>
            {result.created} invoices created totalling {formatNaira(result.totalKobo)}. {result.skippedExisting} already existed. {result.unitsConsidered} occupied units checked.
          </Notice>
        ) : (
          <>
            {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
            <Field id="frequency-generate" label="Billing cycle">
              <Select id="frequency-generate" value={frequency} onChange={(event) => setFrequency(event.target.value as "monthly" | "quarterly")}>
                <option value="monthly">Monthly charges</option>
                <option value="quarterly">Quarterly charges</option>
              </Select>
            </Field>
          </>
        )}
        <div className="flex justify-end gap-2">
          {result ? (
            <Button
              onClick={() => {
                setOpen(false);
                setResult(null);
              }}
            >
              Done
            </Button>
          ) : (
            <Button pending={mutation.pending} pendingLabel="Generating…" onClick={() => mutation.run()}>
              Generate
            </Button>
          )}
        </div>
      </Dialog>
    </>
  );
}

export function ManualInvoiceDialog({ units }: { units: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState([{ key: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation((input: Record<string, unknown>) => api("/api/invoices", { json: input }), {
    onSuccess: () => setOpen(false),
  });
  return (
    <>
      <Button variant="secondary" icon={<Plus size={20} aria-hidden />} onClick={() => setOpen(true)}>
        One off invoice
      </Button>
      <Dialog open={open} onClose={() => !mutation.pending && setOpen(false)} title="Create a one off invoice" description="Saved as a draft. Issue it when you are ready for the resident to see it.">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={submitWith((form) => {
            const descriptions = form.getAll("lineDescription").map(String);
            const amounts = form.getAll("lineAmount").map(String);
            const quantities = form.getAll("lineQuantity").map(String);
            const lineItems = [];
            for (let index = 0; index < descriptions.length; index += 1) {
              const unitPriceKobo = parseNairaToKobo(amounts[index] ?? "");
              const quantity = Number(quantities[index]);
              if (!descriptions[index]?.trim() || !unitPriceKobo || !Number.isInteger(quantity) || quantity < 1) {
                return setError(`Check line ${index + 1}: it needs a description, a whole quantity and an amount.`);
              }
              lineItems.push({ description: descriptions[index]!.trim(), quantity, unitPriceKobo });
            }
            const due = text(form, "dueAt");
            if (!due) return setError("Choose a due date.");
            setError(null);
            void mutation.run({ unitId: text(form, "unitId"), dueAt: new Date(`${due}T23:59`).toISOString(), lineItems });
          })}
        >
          {(error || mutation.error) && <Notice tone="error">{error ?? mutation.error}</Notice>}
          <div className="grid grid-cols-2 gap-3">
            <Field id="unitId" label="Unit">
              <Select id="unitId" name="unitId">
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="dueAt" label="Due date">
              <Input id="dueAt" name="dueAt" type="date" required />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-3">
            <legend className="title-4">Line items</legend>
            {lines.map((line, index) => (
              <div key={line.key} className="grid grid-cols-[1fr_64px_112px_auto] items-end gap-2">
                <Field id={`desc-${line.key}`} label="Description">
                  <Input id={`desc-${line.key}`} name="lineDescription" maxLength={80} />
                </Field>
                <Field id={`qty-${line.key}`} label="Qty">
                  <Input id={`qty-${line.key}`} name="lineQuantity" inputMode="numeric" defaultValue="1" />
                </Field>
                <Field id={`amt-${line.key}`} label="Price (₦)">
                  <Input id={`amt-${line.key}`} name="lineAmount" inputMode="decimal" />
                </Field>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => setLines((current) => current.filter((candidate) => candidate.key !== line.key))}
                  icon={<Trash size={16} aria-hidden />}
                >
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="self-start" icon={<Plus size={16} aria-hidden />} onClick={() => setLines((current) => [...current, { key: Date.now() }])} disabled={lines.length >= 20}>
              Add line
            </Button>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={mutation.pending}>
              Cancel
            </Button>
            <Button type="submit" pending={mutation.pending} pendingLabel="Saving…">
              Save draft
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function InvoiceActions({ invoiceId, unitLabel, status }: { invoiceId: string; unitLabel: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  return (
    <div className="flex justify-end gap-2">
      {status === "draft" && (
        <ConfirmButton
          label="Issue"
          title={`Issue this invoice to ${unitLabel}?`}
          description="The residents of the unit will be notified and can pay it online."
          confirmLabel="Issue invoice"
          variant="primary"
          onConfirm={async () => {
            try {
              await api(`/api/invoices/${invoiceId}/issue`, { method: "POST" });
              router.refresh();
            } catch (error) {
              return errorMessage(error);
            }
          }}
        />
      )}
      {(status === "issued" || status === "overdue") && (
        <ConfirmButton
          label="Void"
          title={`Void the invoice for ${unitLabel}?`}
          description="Voided invoices cannot be paid. The reason is kept in the audit log."
          confirmLabel="Void invoice"
          danger
          onConfirm={async () => {
            if (reason.trim().length < 5) return "Explain why the invoice is being voided.";
            try {
              await api(`/api/invoices/${invoiceId}/void`, { json: { reason } });
              router.refresh();
            } catch (error) {
              return errorMessage(error);
            }
          }}
        >
          <Field id={`void-${invoiceId}`} label="Reason">
            <Textarea id={`void-${invoiceId}`} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
          </Field>
        </ConfirmButton>
      )}
    </div>
  );
}

export function ReverifyButton({ reference }: { reference: string }) {
  const mutation = useMutation(() => api<{ status: string }>("/api/payments/verify", { json: { reference } }));
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" pending={mutation.pending} pendingLabel="Checking…" onClick={() => mutation.run()}>
        Check with provider
      </Button>
      {mutation.error && <p className="max-w-xs text-right caption-1 text-alert-ink">{mutation.error}</p>}
    </div>
  );
}
