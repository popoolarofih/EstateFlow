import { z } from "zod";
import { idSchema, isoDateTimeSchema, koboSchema } from "./common";

export const billingRuleSchema = z.object({
  name: z.string().trim().min(2, { error: "Name the charge." }).max(60),
  description: z.string().trim().max(240).optional().default(""),
  frequency: z.enum(["monthly", "quarterly"]),
  amountKobo: koboSchema,
});

export const generateInvoicesSchema = z.object({
  frequency: z.enum(["monthly", "quarterly"]),
});

export const manualInvoiceSchema = z.object({
  unitId: idSchema,
  dueAt: isoDateTimeSchema,
  lineItems: z
    .array(
      z.object({
        description: z.string().trim().min(2).max(80),
        quantity: z.number().int().min(1).max(1000),
        unitPriceKobo: koboSchema,
      }),
    )
    .min(1, { error: "Add at least one line item." })
    .max(20),
});

export const voidInvoiceSchema = z.object({
  reason: z.string().trim().min(5, { error: "Explain why the invoice is being voided." }).max(300),
});

export const initializePaymentSchema = z.object({ invoiceId: idSchema });

export const verifyPaymentSchema = z.object({
  reference: z.string().regex(/^ef_[a-f0-9]{24}$/, { error: "Unknown payment reference." }),
});
