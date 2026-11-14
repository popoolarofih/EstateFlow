import { z } from "zod";
import { PASS_TYPES } from "@/types/domain";
import { clockSchema, idSchema, isoDateTimeSchema, nameSchema, optionalPhoneSchema } from "./common";

export const recurrenceSchema = z.object({
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(1, { error: "Pick at least one day." })
    .max(7)
    .transform((days) => [...new Set(days)].sort()),
  startTime: clockSchema,
  endTime: clockSchema,
});

export const createPassSchema = z
  .object({
    guestName: nameSchema,
    guestPhone: optionalPhoneSchema,
    passType: z.enum(PASS_TYPES),
    validFrom: isoDateTimeSchema,
    validUntil: isoDateTimeSchema,
    recurrence: recurrenceSchema.nullish(),
    allowedGateIds: z.array(idSchema).max(10).optional().default([]),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.validUntil) <= new Date(value.validFrom)) {
      ctx.addIssue({ code: "custom", path: ["validUntil"], message: "End time must be after the start time." });
    }
    if (value.passType === "staff" && !value.recurrence) {
      ctx.addIssue({ code: "custom", path: ["recurrence"], message: "Staff passes need allowed days and hours." });
    }
    if (value.passType !== "staff" && value.recurrence) {
      ctx.addIssue({ code: "custom", path: ["recurrence"], message: "Only staff passes can repeat." });
    }
  });

export type CreatePassInput = z.input<typeof createPassSchema>;

export const verifyPassSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("code"),
    gateId: idSchema,
    code: z.string().regex(/^\d{6}$/, { error: "Enter the six digit code." }),
  }),
  z.object({
    method: z.literal("qr"),
    gateId: idSchema,
    qr: z.string().min(10).max(1024),
  }),
]);

export const recordExitSchema = z.object({
  gateId: idSchema,
  entryEventId: idSchema,
});
