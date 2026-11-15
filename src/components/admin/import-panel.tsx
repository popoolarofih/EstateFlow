"use client";

import { DownloadSimple, UploadSimple } from "@/components/ui/icons";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { useMutation } from "@/components/ui/use-mutation";
import { api } from "@/lib/api/client";
import type { ImportPlan } from "@/lib/imports/residents";
import { CopyLink } from "./invite-dialog";

interface ImportResult {
  plan: ImportPlan;
  committed: boolean;
  importId: string | null;
  invites: { id: string; link: string; displayName: string }[];
}

const TEMPLATE = "unit_label,block,floor,resident_name,resident_email,resident_phone\n14B,Palm Close,,Adaeze Okafor,adaeze@example.com,08031234567\n";

/** CSV import: validate and preview first, then commit. The server re-validates on commit. */
export function ImportPanel() {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const previewMutation = useMutation((text: string) => api<ImportResult>("/api/imports/residents", { json: { csv: text, mode: "preview" } }), {
    refresh: false,
    onSuccess: setPreview,
  });
  const commitMutation = useMutation((text: string) => api<ImportResult>("/api/imports/residents", { json: { csv: text, mode: "commit" } }), {
    onSuccess: (value) => {
      setResult(value);
      setPreview(null);
    },
  });

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;
  const plan = preview?.plan;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 button-md hover:bg-canvas">
          <UploadSimple size={20} aria-hidden />
          {fileName ?? "Choose CSV file"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              setResult(null);
              setPreview(null);
              if (!file) return;
              if (file.size > 1_000_000) {
                setCsv(null);
                setFileName("File is over 1 MB");
                return;
              }
              const text = await file.text();
              setCsv(text);
              setFileName(file.name);
              void previewMutation.run(text);
            }}
          />
        </label>
        <a href={templateHref} download="estateflow_residents_template.csv" className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 button-sm text-violet-ink hover:bg-violet-soft">
          <DownloadSimple size={18} aria-hidden /> Download template
        </a>
      </div>

      {previewMutation.pending && <p role="status" className="body-6 text-muted">Checking the file…</p>}
      {previewMutation.error && <Notice tone="error">{previewMutation.error}</Notice>}
      {commitMutation.error && <Notice tone="error">{commitMutation.error}</Notice>}

      {plan && (
        <div className="flex flex-col gap-4">
          {plan.fileErrors.map((error) => (
            <Notice key={error} tone="warning">
              {error}
            </Notice>
          ))}
          <div className="flex flex-wrap gap-2">
            <Badge tone="violet">{plan.summary.unitsToCreate} new units</Badge>
            <Badge tone="neutral">{plan.summary.existingUnits} existing units</Badge>
            <Badge tone="teal">{plan.summary.invitesToSend} invitations</Badge>
            <Badge tone="gold">{plan.summary.duplicates} duplicates skipped</Badge>
            <Badge tone="alert">{plan.summary.errorRows} rows with errors</Badge>
          </div>
          {plan.rows.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <Th>Row</Th>
                  <Th>Unit</Th>
                  <Th>Resident</Th>
                  <Th>Outcome</Th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.slice(0, 200).map((row) => (
                  <tr key={row.rowNumber}>
                    <Td>{row.rowNumber}</Td>
                    <Td>
                      {row.unitLabel}
                      {row.block ? `, ${row.block}` : ""}
                    </Td>
                    <Td>{row.residentName ?? "None"}</Td>
                    <Td>
                      {row.errors.length > 0 ? (
                        <span className="text-alert-ink">{row.errors.join(" ")}</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          <Badge tone={row.unitAction === "create" ? "violet" : "neutral"}>{row.unitAction === "create" ? "New unit" : "Existing unit"}</Badge>
                          {row.residentAction === "invite" && <Badge tone="teal">Invite</Badge>}
                          {row.residentAction === "skip_duplicate" && <Badge tone="gold">Duplicate in file</Badge>}
                          {row.residentAction === "skip_existing" && <Badge tone="gold">Already invited</Badge>}
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <div className="flex justify-end">
            <Button
              disabled={!csv || plan.summary.validRows === 0}
              pending={commitMutation.pending}
              pendingLabel="Importing…"
              onClick={() => csv && commitMutation.run(csv)}
            >
              Import {plan.summary.validRows} valid rows
            </Button>
          </div>
        </div>
      )}

      {result?.committed && (
        <div className="flex flex-col gap-3">
          <Notice tone="success" title="Import complete">
            {result.plan.summary.unitsToCreate} units created and {result.invites.length} invitations prepared. Rows with errors were skipped.
          </Notice>
          {result.invites.length > 0 && (
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer title-4">Invitation links (shown only now)</summary>
              <ul className="mt-3 flex flex-col gap-3">
                {result.invites.map((invite) => (
                  <li key={invite.id} className="flex flex-col gap-1">
                    <p className="body-5">{invite.displayName}</p>
                    <CopyLink link={invite.link} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
