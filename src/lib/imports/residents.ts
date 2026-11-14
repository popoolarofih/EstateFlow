import Papa from "papaparse";
import { z } from "zod";
import { normalizeNigerianPhone } from "@/lib/validation/common";

/**
 * Resident / unit CSV import planning (blueprint sections 3 and 15, sprint 1). The planner is
 * pure: it validates rows, detects duplicates inside the file and against existing records,
 * and describes what a commit would do. Nothing is written here.
 */

export const IMPORT_MAX_ROWS = 1000;

export const IMPORT_COLUMNS = [
  "unit_label",
  "block",
  "floor",
  "resident_name",
  "resident_email",
  "resident_phone",
] as const;

const rowSchema = z.object({
  unit_label: z.string().trim().min(1, { error: "Unit label is required." }).max(40, { error: "Unit label is too long." }),
  block: z.string().trim().max(40, { error: "Block is too long." }).optional().default(""),
  floor: z.string().trim().max(20, { error: "Floor is too long." }).optional().default(""),
  resident_name: z.string().trim().max(80, { error: "Name is too long." }).optional().default(""),
  resident_email: z.string().trim().toLowerCase().optional().default(""),
  resident_phone: z.string().trim().optional().default(""),
});

export interface ExistingDirectory {
  /** Map of unit key (see `unitKey`) to unit id. */
  unitsByKey: ReadonlyMap<string, string>;
  /** Emails already belonging to a member or a pending invite in this estate. */
  knownEmails: ReadonlySet<string>;
  /** Phones (E.164) already belonging to a member or a pending invite. */
  knownPhones: ReadonlySet<string>;
}

export type UnitAction = "create" | "existing" | "none";
export type ResidentAction = "invite" | "none" | "skip_duplicate" | "skip_existing";

export interface PlannedRow {
  rowNumber: number;
  unitLabel: string;
  block: string | null;
  floor: string | null;
  unitKey: string;
  unitAction: UnitAction;
  existingUnitId: string | null;
  residentName: string | null;
  residentEmail: string | null;
  residentPhone: string | null;
  residentAction: ResidentAction;
  errors: string[];
}

export interface ImportPlan {
  rows: PlannedRow[];
  fileErrors: string[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    unitsToCreate: number;
    existingUnits: number;
    invitesToSend: number;
    duplicates: number;
  };
}

export function unitKey(label: string, block: string | null | undefined): string {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return `${normalize(block ?? "")}|${normalize(label)}`;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function parseResidentCsv(csv: string): { records: Record<string, string>[]; fileErrors: string[] } {
  const result = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  const fileErrors: string[] = [];
  const headers = result.meta.fields ?? [];
  if (!headers.includes("unit_label")) fileErrors.push('The file needs a "unit_label" column.');
  const unknown = headers.filter((header) => !(IMPORT_COLUMNS as readonly string[]).includes(header));
  if (unknown.length > 0) fileErrors.push(`Unknown columns ignored: ${unknown.join(", ")}.`);
  for (const error of result.errors.slice(0, 5)) {
    fileErrors.push(`Row ${(error.row ?? 0) + 2}: ${error.message}`);
  }
  if (result.data.length > IMPORT_MAX_ROWS) {
    fileErrors.push(`Files are limited to ${IMPORT_MAX_ROWS} rows. Split the file and import in parts.`);
  }
  return { records: result.data.slice(0, IMPORT_MAX_ROWS), fileErrors };
}

export function planResidentImport(csv: string, existing: ExistingDirectory): ImportPlan {
  const { records, fileErrors } = parseResidentCsv(csv);
  const blocking = fileErrors.some((error) => error.includes("unit_label") || error.includes("limited"));
  if (blocking) {
    return {
      rows: [],
      fileErrors,
      summary: { totalRows: 0, validRows: 0, errorRows: 0, unitsToCreate: 0, existingUnits: 0, invitesToSend: 0, duplicates: 0 },
    };
  }
  const seenUnits = new Set<string>();
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const rows: PlannedRow[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2; // header is row 1
    const errors: string[] = [];
    const parsed = rowSchema.safeParse(record);
    if (!parsed.success) {
      rows.push({
        rowNumber,
        unitLabel: String(record.unit_label ?? ""),
        block: null,
        floor: null,
        unitKey: "",
        unitAction: "none",
        existingUnitId: null,
        residentName: null,
        residentEmail: null,
        residentPhone: null,
        residentAction: "none",
        errors: parsed.error.issues.map((issue) => issue.message),
      });
      return;
    }
    const data = parsed.data;
    const key = unitKey(data.unit_label, data.block);
    const existingUnitId = existing.unitsByKey.get(key) ?? null;

    let email: string | null = null;
    if (data.resident_email) {
      const check = z.email().safeParse(data.resident_email);
      if (check.success) email = check.data;
      else errors.push("Resident email is not valid.");
    }
    let phone: string | null = null;
    if (data.resident_phone) {
      phone = normalizeNigerianPhone(data.resident_phone);
      if (!phone) errors.push("Resident phone is not a valid Nigerian number.");
    }
    const hasResident = Boolean(data.resident_name || data.resident_email || data.resident_phone);
    if (hasResident && data.resident_name.length < 2) errors.push("Resident name is required when contact details are given.");
    if (hasResident && !data.resident_email && !data.resident_phone) {
      errors.push("Give an email or phone number so the resident can be invited.");
    }

    let residentAction: ResidentAction = "none";
    if (hasResident && errors.length === 0) {
      const duplicateInFile = (email && seenEmails.has(email)) || (phone && seenPhones.has(phone));
      const alreadyKnown = (email && existing.knownEmails.has(email)) || (phone && existing.knownPhones.has(phone));
      if (duplicateInFile) residentAction = "skip_duplicate";
      else if (alreadyKnown) residentAction = "skip_existing";
      else residentAction = "invite";
      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);
    }

    let unitAction: UnitAction = "none";
    if (errors.length === 0) {
      if (existingUnitId) unitAction = "existing";
      else if (seenUnits.has(key)) unitAction = "existing";
      else unitAction = "create";
      seenUnits.add(key);
    }

    rows.push({
      rowNumber,
      unitLabel: data.unit_label,
      block: data.block || null,
      floor: data.floor || null,
      unitKey: key,
      unitAction,
      existingUnitId,
      residentName: data.resident_name || null,
      residentEmail: email,
      residentPhone: phone,
      residentAction,
      errors,
    });
  });

  const errorRows = rows.filter((row) => row.errors.length > 0).length;
  return {
    rows,
    fileErrors,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - errorRows,
      errorRows,
      unitsToCreate: rows.filter((row) => row.unitAction === "create").length,
      existingUnits: rows.filter((row) => row.unitAction === "existing").length,
      invitesToSend: rows.filter((row) => row.residentAction === "invite").length,
      duplicates: rows.filter((row) => row.residentAction === "skip_duplicate" || row.residentAction === "skip_existing")
        .length,
    },
  };
}
