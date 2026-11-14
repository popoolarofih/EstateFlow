import { z } from "zod";
import { emailSchema, nameSchema, phoneSchema } from "./common";

const gateSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9_]{2,32}$/, { error: "Gate ids use lowercase letters, numbers and underscores." }),
  name: z.string().trim().min(2).max(40),
});

export const createEstateSchema = z.object({
  name: z.string().trim().min(3).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, { error: "Use lowercase letters, numbers and underscores only." })
    .min(3)
    .max(40),
  address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  timezone: z.string().trim().default("Africa/Lagos"),
  planId: z.enum(["pilot", "standard"]).default("pilot"),
  gates: z.array(gateSchema).min(1, { error: "Add at least one gate." }).max(20),
  managerName: nameSchema,
  managerEmail: emailSchema,
});

export const updateEstateSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  address: z.string().trim().min(5).max(200).optional(),
  gates: z.array(gateSchema).min(1).max(20).optional(),
  emergencyContacts: z
    .array(z.object({ label: z.string().trim().min(2).max(40), phone: phoneSchema }))
    .max(6)
    .optional(),
  settings: z
    .object({
      maxActivePassesPerUnit: z.number().int().min(1).max(200),
      ticketReopenDays: z.number().int().min(0).max(60),
      expenseDualApprovalThresholdKobo: z.number().int().min(0).max(100_000_000_000),
      invoiceDueDays: z.number().int().min(1).max(90),
      autoGenerateInvoices: z.boolean(),
    })
    .optional(),
  paymentConfig: z
    .object({
      enabled: z.boolean(),
      subaccountCode: z
        .string()
        .trim()
        .regex(/^ACCT_[A-Za-z0-9]+$/, { error: "Paystack subaccount codes start with ACCT_." })
        .nullable(),
      transactionChargeKobo: z.number().int().min(0).max(10_000_000).nullable(),
    })
    .optional(),
});

export const pilotRequestSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  estateName: z.string().trim().min(3, { error: "Enter the estate name." }).max(80),
  city: z.string().trim().min(2, { error: "Enter the city." }).max(60),
  units: z.coerce.number().int().min(5, { error: "Pilots start at 5 units." }).max(5000),
  message: z.string().trim().max(1000).optional().default(""),
  /** Honeypot field: real people never fill it. */
  website: z.string().max(0).optional().default(""),
});
