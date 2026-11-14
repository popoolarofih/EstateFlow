import { parseClock, zonedParts } from "@/lib/time";
import type { PassDecisionReason, VisitorPass } from "@/types/domain";

export type EvaluablePass = Pick<
  VisitorPass,
  "status" | "validFrom" | "validUntil" | "maxUses" | "useCount" | "allowedGateIds" | "recurrence"
>;

export interface PassEvaluationContext {
  now: Date;
  gateId: string;
  timezone: string;
}

export interface PassEvaluation {
  allow: boolean;
  reason: PassDecisionReason;
}

/** Returns true when `now` falls inside the recurring staff window (overnight windows supported). */
export function withinRecurrence(
  recurrence: NonNullable<VisitorPass["recurrence"]>,
  now: Date,
  timezone: string,
): boolean {
  const { weekday, minutesOfDay } = zonedParts(now, timezone);
  const start = parseClock(recurrence.startTime);
  const end = parseClock(recurrence.endTime);
  const days = new Set(recurrence.daysOfWeek);
  if (start === end) return days.has(weekday);
  if (start < end) {
    return days.has(weekday) && minutesOfDay >= start && minutesOfDay < end;
  }
  // Overnight window, e.g. 20:00 to 06:00. Late part belongs to today, early part to yesterday.
  const yesterday = (weekday + 6) % 7;
  return (days.has(weekday) && minutesOfDay >= start) || (days.has(yesterday) && minutesOfDay < end);
}

/**
 * Pure decision function for gate verification. The caller is responsible for loading the
 * pass by an estate scoped lookup; a pass that could not be found is `not_recognised`.
 */
export function evaluatePass(pass: EvaluablePass | null, context: PassEvaluationContext): PassEvaluation {
  if (!pass) return { allow: false, reason: "not_recognised" };
  const now = context.now.getTime();

  if (pass.status === "revoked") return { allow: false, reason: "revoked" };
  if (pass.status === "expired" || now > pass.validUntil.getTime()) return { allow: false, reason: "expired" };
  if (pass.status === "used" || (pass.maxUses !== null && pass.useCount >= pass.maxUses)) {
    return { allow: false, reason: "already_used" };
  }
  if (now < pass.validFrom.getTime()) return { allow: false, reason: "not_yet_valid" };
  if (pass.allowedGateIds.length > 0 && !pass.allowedGateIds.includes(context.gateId)) {
    return { allow: false, reason: "wrong_gate" };
  }
  if (pass.recurrence && !withinRecurrence(pass.recurrence, context.now, context.timezone)) {
    return { allow: false, reason: "outside_schedule" };
  }
  return { allow: true, reason: "valid" };
}

/** Status after a successful entry is recorded. */
export function statusAfterUse(pass: Pick<VisitorPass, "maxUses" | "useCount">): "active" | "used" {
  const nextCount = pass.useCount + 1;
  return pass.maxUses !== null && nextCount >= pass.maxUses ? "used" : "active";
}

export type GuardTone = "allow" | "deny" | "caution";

export interface GuardMessage {
  tone: GuardTone;
  headline: string;
  detail: string;
}

/** Plain language copy for the guard screen (blueprint section 9, guard screen states). */
export function guardMessage(reason: PassDecisionReason): GuardMessage {
  switch (reason) {
    case "valid":
      return { tone: "allow", headline: "Allow entry", detail: "Entry recorded." };
    case "not_recognised":
      return { tone: "deny", headline: "Do not allow", detail: "Code not recognised." };
    case "wrong_gate":
      return { tone: "deny", headline: "Do not allow", detail: "This pass is not valid at this gate." };
    case "expired":
      return { tone: "deny", headline: "Pass expired", detail: "Ask the resident to issue a new pass." };
    case "revoked":
      return { tone: "deny", headline: "Pass revoked", detail: "Escalate to a supervisor if disputed." };
    case "already_used":
      return { tone: "caution", headline: "Pass already used", detail: "This pass has no entries left." };
    case "not_yet_valid":
      return { tone: "caution", headline: "Pass not active yet", detail: "Ask the guest to wait or call the resident." };
    case "outside_schedule":
      return { tone: "deny", headline: "Outside allowed hours", detail: "This staff pass is not valid right now." };
  }
}

export function defaultMaxUses(passType: VisitorPass["passType"]): number | null {
  return passType === "staff" ? null : 1;
}
