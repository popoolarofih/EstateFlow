import { z } from "zod";

/** Normalises Nigerian phone numbers to E.164 (+234XXXXXXXXXX). Returns null if invalid. */
export function normalizeNigerianPhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, "");
  let national: string | null = null;
  if (/^\+234\d{10}$/.test(digits)) national = digits.slice(4);
  else if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  if (!national || !/^[789]\d{9}$/.test(national)) return null;
  return `+234${national}`;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeNigerianPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Nigerian phone number, for example 0803 123 4567." });
      return z.NEVER;
    }
    return normalized;
  });

export const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const normalized = normalizeNigerianPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Nigerian phone number, for example 0803 123 4567." });
      return z.NEVER;
    }
    return normalized;
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));

export const nameSchema = z
  .string()
  .trim()
  .min(2, { error: "Enter at least 2 characters." })
  .max(80, { error: "Keep this under 80 characters." });

export const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, { error: "Invalid identifier." });

export const isoDateTimeSchema = z.iso.datetime({ offset: true, error: "Enter a valid date and time." });

export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { error: "Use the HH:MM format." });

/** Integer kobo from a client. Always re-validated against server side records. */
export const koboSchema = z
  .number()
  .int({ error: "Amount must be whole kobo." })
  .positive({ error: "Amount must be greater than zero." })
  .max(100_000_000_000, { error: "Amount is too large." });
