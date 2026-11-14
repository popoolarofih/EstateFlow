import { z } from "zod";
import { koboSchema } from "./common";

/** Parsed from multipart form fields (strings), hence the coercions. */
export const ledgerDraftSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    category: z.string().trim().min(2, { error: "Choose a category." }).max(60),
    vendor: z.string().trim().max(80).optional().default(""),
    description: z.string().trim().min(5, { error: "Describe the transaction." }).max(300),
    amountKobo: z.coerce.number().pipe(koboSchema),
    transactionDate: z.iso.date({ error: "Enter the transaction date." }),
  })
  .superRefine((value, ctx) => {
    if (value.type === "expense" && value.vendor.length < 2) {
      ctx.addIssue({ code: "custom", path: ["vendor"], message: "Expenses need a vendor." });
    }
  });

export const ledgerReverseSchema = z.object({
  reason: z.string().trim().min(5, { error: "Explain why this entry is being reversed." }).max(300),
});
