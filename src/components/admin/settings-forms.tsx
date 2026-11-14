"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { submitWith, text } from "@/components/ui/forms";
import { useMutation } from "@/components/ui/use-mutation";
import { api } from "@/lib/api/client";
import { koboToNairaInput, parseNairaToKobo } from "@/lib/money";
import type { EmergencyContact, Estate, Gate } from "@/types/domain";

function useEstatePatch() {
  const [saved, setSaved] = useState(false);
  const mutation = useMutation((body: Record<string, unknown>) => api("/api/estates/current", { method: "PATCH", json: body }), {
    onSuccess: () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    },
  });
  return { ...mutation, saved };
}

function Status({ error, saved }: { error: string | null; saved: boolean }) {
  if (error) return <Notice tone="error">{error}</Notice>;
  if (saved) return <Notice tone="success">Changes saved.</Notice>;
  return null;
}

export function EstateDetailsForm({ estate }: { estate: Pick<Estate, "name" | "address"> }) {
  const patch = useEstatePatch();
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={submitWith((form) => patch.run({ name: text(form, "name"), address: text(form, "address") }))}>
      <Status error={patch.error} saved={patch.saved} />
      <Field id="estate-name" label="Estate name">
        <Input id="estate-name" name="name" defaultValue={estate.name} maxLength={80} required />
      </Field>
      <Field id="estate-address" label="Address">
        <Input id="estate-address" name="address" defaultValue={estate.address} maxLength={200} required />
      </Field>
      <Button type="submit" className="self-end" pending={patch.pending} pendingLabel="Saving…">
        Save details
      </Button>
    </form>
  );
}

export function GatesForm({ gates }: { gates: Gate[] }) {
  const patch = useEstatePatch();
  const [rows, setRows] = useState(gates.map((gate, index) => ({ ...gate, key: index })));
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={submitWith(() => patch.run({ gates: rows.map(({ id, name }) => ({ id: id.trim(), name: name.trim() })) }))}
    >
      <Status error={patch.error} saved={patch.saved} />
      {rows.map((row, index) => (
        <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field id={`gate-name-${row.key}`} label="Gate name">
            <Input id={`gate-name-${row.key}`} value={row.name} onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))} />
          </Field>
          <Field id={`gate-id-${row.key}`} label="Gate id" hint={index === 0 ? "Lowercase, never change once in use." : undefined}>
            <Input id={`gate-id-${row.key}`} value={row.id} onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, id: event.target.value.toLowerCase() } : item)))} />
          </Field>
          <Button variant="ghost" size="sm" aria-label={`Remove ${row.name || "gate"}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, i) => i !== index))} icon={<Trash size={16} aria-hidden />}>
            <span className="sr-only">Remove</span>
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" size="sm" icon={<Plus size={16} aria-hidden />} disabled={rows.length >= 20} onClick={() => setRows([...rows, { id: "", name: "", key: Date.now() }])}>
          Add gate
        </Button>
        <Button type="submit" pending={patch.pending} pendingLabel="Saving…">
          Save gates
        </Button>
      </div>
    </form>
  );
}

export function ContactsForm({ contacts }: { contacts: EmergencyContact[] }) {
  const patch = useEstatePatch();
  const [rows, setRows] = useState(contacts.map((contact, index) => ({ ...contact, key: index })));
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={submitWith(() => patch.run({ emergencyContacts: rows.map(({ label, phone }) => ({ label: label.trim(), phone: phone.trim() })) }))}>
      <Status error={patch.error} saved={patch.saved} />
      {rows.length === 0 && <p className="body-6 text-muted">Add the security supervisor and facility manager numbers residents and guards should call if the app is down.</p>}
      {rows.map((row, index) => (
        <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field id={`contact-label-${row.key}`} label="Who">
            <Input id={`contact-label-${row.key}`} value={row.label} placeholder="Security supervisor" onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))} />
          </Field>
          <Field id={`contact-phone-${row.key}`} label="Phone">
            <Input id={`contact-phone-${row.key}`} type="tel" value={row.phone} onChange={(event) => setRows(rows.map((item, i) => (i === index ? { ...item, phone: event.target.value } : item)))} />
          </Field>
          <Button variant="ghost" size="sm" aria-label={`Remove ${row.label || "contact"}`} onClick={() => setRows(rows.filter((_, i) => i !== index))} icon={<Trash size={16} aria-hidden />}>
            <span className="sr-only">Remove</span>
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" size="sm" icon={<Plus size={16} aria-hidden />} disabled={rows.length >= 6} onClick={() => setRows([...rows, { label: "", phone: "", key: Date.now() }])}>
          Add contact
        </Button>
        <Button type="submit" pending={patch.pending} pendingLabel="Saving…">
          Save contacts
        </Button>
      </div>
    </form>
  );
}

export function OperationsForm({ settings }: { settings: Estate["settings"] }) {
  const patch = useEstatePatch();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={submitWith((form) => {
        const threshold = parseNairaToKobo(text(form, "threshold") || "0");
        if (threshold === null) return setError("Enter the approval threshold in naira.");
        setError(null);
        void patch.run({
          settings: {
            maxActivePassesPerUnit: Number(text(form, "maxPasses")),
            ticketReopenDays: Number(text(form, "reopenDays")),
            invoiceDueDays: Number(text(form, "dueDays")),
            expenseDualApprovalThresholdKobo: threshold,
            autoGenerateInvoices: form.get("autoGenerate") === "on",
          },
        });
      })}
    >
      <Status error={error ?? patch.error} saved={patch.saved} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="maxPasses" label="Active passes per unit">
          <Input id="maxPasses" name="maxPasses" type="number" min={1} max={200} defaultValue={settings.maxActivePassesPerUnit} />
        </Field>
        <Field id="dueDays" label="Invoice due after (days)">
          <Input id="dueDays" name="dueDays" type="number" min={1} max={90} defaultValue={settings.invoiceDueDays} />
        </Field>
        <Field id="reopenDays" label="Residents can reopen tickets for (days)">
          <Input id="reopenDays" name="reopenDays" type="number" min={0} max={60} defaultValue={settings.ticketReopenDays} />
        </Field>
        <Field id="threshold" label="Second approver from (₦)" hint="Set 0 to always need one approver.">
          <Input id="threshold" name="threshold" inputMode="decimal" defaultValue={koboToNairaInput(settings.expenseDualApprovalThresholdKobo)} />
        </Field>
      </div>
      <label className="flex min-h-12 items-center gap-3 body-5">
        <input type="checkbox" name="autoGenerate" defaultChecked={settings.autoGenerateInvoices} className="size-5 accent-violet" />
        Generate invoices automatically on the first day of each period
      </label>
      <Button type="submit" className="self-end" pending={patch.pending} pendingLabel="Saving…">
        Save settings
      </Button>
    </form>
  );
}

export function PaymentsForm({ config }: { config: Estate["paymentConfig"] }) {
  const patch = useEstatePatch();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={submitWith((form) => {
        const subaccountCode = text(form, "subaccount") || null;
        const charge = text(form, "charge");
        const transactionChargeKobo = charge ? parseNairaToKobo(charge) : null;
        if (charge && transactionChargeKobo === null) return setError("Enter the platform charge in naira.");
        setError(null);
        void patch.run({ paymentConfig: { enabled: form.get("enabled") === "on", subaccountCode, transactionChargeKobo } });
      })}
    >
      <Status error={error ?? patch.error} saved={patch.saved} />
      <Notice tone="info">
        Payment provider keys are held on the server only. Use a Paystack subaccount only after the estate, the provider and EstateFlow have agreed the settlement arrangement in writing.
      </Notice>
      <label className="flex min-h-12 items-center gap-3 body-5">
        <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="size-5 accent-violet" />
        Allow residents to pay online with Paystack
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="subaccount" label="Paystack subaccount code" optional>
          <Input id="subaccount" name="subaccount" defaultValue={config.subaccountCode ?? ""} placeholder="ACCT_..." />
        </Field>
        <Field id="charge" label="Flat platform charge (₦)" optional hint="Only applied together with a subaccount.">
          <Input id="charge" name="charge" inputMode="decimal" defaultValue={config.transactionChargeKobo ? koboToNairaInput(config.transactionChargeKobo) : ""} />
        </Field>
      </div>
      <Button type="submit" className="self-end" pending={patch.pending} pendingLabel="Saving…">
        Save payment settings
      </Button>
    </form>
  );
}
