import type { EmergencyAlert, EmergencyCategory } from "@/types/domain";

/** Minutes without acknowledgement before each escalation level. */
export const ESCALATION_MINUTES = [2, 5] as const;

export function escalationLevelDue(
  alert: Pick<EmergencyAlert, "status" | "createdAt" | "escalationLevel">,
  now: Date,
): number | null {
  if (alert.status !== "open") return null;
  const ageMinutes = (now.getTime() - alert.createdAt.getTime()) / 60_000;
  let level = 0;
  for (const threshold of ESCALATION_MINUTES) {
    if (ageMinutes >= threshold) level += 1;
  }
  return level > alert.escalationLevel ? level : null;
}

export function canAcknowledge(alert: Pick<EmergencyAlert, "status">): boolean {
  return alert.status === "open";
}

export function canResolve(alert: Pick<EmergencyAlert, "status">): boolean {
  return alert.status === "open" || alert.status === "acknowledged";
}

export const EMERGENCY_CATEGORY_LABELS: Record<EmergencyCategory, string> = {
  security: "Security threat",
  medical: "Medical emergency",
  fire: "Fire",
  other: "Other emergency",
};
