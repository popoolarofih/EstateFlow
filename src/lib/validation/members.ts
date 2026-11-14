import { z } from "zod";
import { GRANTABLE_PERMISSIONS, ROLES } from "@/types/domain";
import { emailSchema, idSchema, nameSchema, optionalPhoneSchema } from "./common";

export const createInviteSchema = z
  .object({
    displayName: nameSchema,
    email: emailSchema.optional().or(z.literal("").transform(() => undefined)),
    phone: optionalPhoneSchema,
    role: z.enum(ROLES),
    unitId: idSchema.nullish(),
    gateIds: z.array(idSchema).max(10).optional().default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Give an email or phone number." });
    }
    if (value.role === "resident" && !value.unitId) {
      ctx.addIssue({ code: "custom", path: ["unitId"], message: "Residents must be linked to a unit." });
    }
    if (value.role === "guard" && value.gateIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["gateIds"], message: "Assign the guard to at least one gate." });
    }
  });

export const acceptInviteSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, { error: "This invitation link is not valid." }),
});

export const updateMemberSchema = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  gateIds: z.array(idSchema).max(10).optional(),
  unitId: idSchema.nullish(),
  permissions: z.array(z.enum(GRANTABLE_PERMISSIONS)).max(GRANTABLE_PERMISSIONS.length).optional(),
});

export const switchEstateSchema = z.object({ estateId: idSchema });

export const unitSchema = z.object({
  label: z.string().trim().min(1, { error: "Enter the unit label, for example 14B." }).max(40),
  block: z.string().trim().max(40).optional().default(""),
  floor: z.string().trim().max(20).optional().default(""),
  occupancyStatus: z.enum(["occupied", "vacant"]).default("vacant"),
});

export const importSchema = z.object({
  csv: z.string().min(1, { error: "Choose a CSV file." }).max(1_000_000, { error: "The file is too large." }),
  mode: z.enum(["preview", "commit"]),
});
