import { z } from "zod";
import { EMERGENCY_CATEGORIES, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/domain";
import { idSchema } from "./common";

export const createTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  title: z.string().trim().min(4, { error: "Give the issue a short title." }).max(80),
  description: z.string().trim().min(10, { error: "Describe the issue in a little more detail." }).max(2000),
  priority: z.enum(TICKET_PRIORITIES).default("normal"),
});

export const transitionTicketSchema = z.object({
  to: z.enum(TICKET_STATUSES),
  assigneeUid: idSchema.nullish(),
  resolutionNotes: z.string().trim().max(1000).nullish(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
});

export const commentTicketSchema = z.object({
  body: z.string().trim().min(1, { error: "Write a comment." }).max(1000),
});

export const createEmergencySchema = z.object({
  category: z.enum(EMERGENCY_CATEGORIES),
  locationText: z.string().trim().max(200).optional().default(""),
});

export const resolveEmergencySchema = z.object({
  resolutionNotes: z.string().trim().min(3, { error: "Add a short note on how this was resolved." }).max(1000),
});
