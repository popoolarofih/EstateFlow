"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const KINDS = [
  { kind: "invoices", label: "Invoices" },
  { kind: "payments", label: "Collections" },
  { kind: "expenses", label: "Expenses" },
  { kind: "gate-events", label: "Gate events" },
] as const;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** CSV exports for a date range; every export is audited on the server. */
export function ExportPanel() {
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const query = `from=${from}&to=${to}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="export-from" label="From">
          <Input id="export-from" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field id="export-to" label="To">
          <Input id="export-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(({ kind, label }) => (
          <a key={kind} href={`/api/exports/${kind}?${query}`} className={buttonClasses("secondary", "sm")} download>
            <DownloadSimple size={16} aria-hidden />
            <span>{label} CSV</span>
          </a>
        ))}
      </div>
    </div>
  );
}
