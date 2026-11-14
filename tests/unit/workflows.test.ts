import { describe, expect, it } from "vitest";
import { escalationLevelDue } from "@/lib/emergency/workflow";
import { canTransition, isSlaBreached, targetSlaFor } from "@/lib/maintenance/workflow";

const now = new Date("2026-11-14T12:00:00Z");

describe("maintenance transitions", () => {
  const base = { resolvedAt: null, closedAt: null };

  it("follows the manager transition table", () => {
    expect(canTransition({ ticket: { ...base, status: "new" }, to: "triaged", actor: "manager", now, reopenDays: 7 }).ok).toBe(true);
    expect(canTransition({ ticket: { ...base, status: "new" }, to: "resolved", actor: "manager", now, reopenDays: 7 }).ok).toBe(false);
    expect(canTransition({ ticket: { ...base, status: "in_progress" }, to: "awaiting_parts", actor: "manager", now, reopenDays: 7 }).ok).toBe(true);
  });

  it("requires an assignee and resolution notes", () => {
    expect(canTransition({ ticket: { ...base, status: "triaged" }, to: "assigned", actor: "manager", now, reopenDays: 7 }).ok).toBe(false);
    expect(canTransition({ ticket: { ...base, status: "triaged" }, to: "assigned", actor: "manager", now, reopenDays: 7, assigneeUid: "m1" }).ok).toBe(true);
    expect(canTransition({ ticket: { ...base, status: "in_progress" }, to: "resolved", actor: "manager", now, reopenDays: 7, resolutionNotes: " " }).ok).toBe(false);
    expect(canTransition({ ticket: { ...base, status: "in_progress" }, to: "resolved", actor: "manager", now, reopenDays: 7, resolutionNotes: "Replaced valve" }).ok).toBe(true);
  });

  it("lets residents confirm or reopen only within the reopen window", () => {
    const resolved = { status: "resolved" as const, resolvedAt: new Date("2026-11-10T12:00:00Z"), closedAt: null };
    expect(canTransition({ ticket: resolved, to: "closed", actor: "owner", now, reopenDays: 7 }).ok).toBe(true);
    expect(canTransition({ ticket: resolved, to: "triaged", actor: "owner", now, reopenDays: 7 }).ok).toBe(true);
    expect(canTransition({ ticket: resolved, to: "triaged", actor: "owner", now, reopenDays: 2 }).ok).toBe(false);
    expect(canTransition({ ticket: { ...base, status: "new" }, to: "closed", actor: "owner", now, reopenDays: 7 }).ok).toBe(false);
  });

  it("computes SLA targets by priority", () => {
    expect(targetSlaFor("urgent", now).toISOString()).toBe("2026-11-14T16:00:00.000Z");
    expect(isSlaBreached({ status: "assigned", targetSlaAt: new Date("2026-11-14T11:00:00Z") }, now)).toBe(true);
    expect(isSlaBreached({ status: "resolved", targetSlaAt: new Date("2026-11-14T11:00:00Z") }, now)).toBe(false);
  });
});

describe("emergency escalation", () => {
  it("escalates unacknowledged alerts after 2 and 5 minutes, once per level", () => {
    const createdAt = new Date(now.getTime() - 3 * 60_000);
    expect(escalationLevelDue({ status: "open", createdAt, escalationLevel: 0 }, now)).toBe(1);
    expect(escalationLevelDue({ status: "open", createdAt, escalationLevel: 1 }, now)).toBeNull();
    expect(escalationLevelDue({ status: "open", createdAt: new Date(now.getTime() - 6 * 60_000), escalationLevel: 1 }, now)).toBe(2);
    expect(escalationLevelDue({ status: "acknowledged", createdAt, escalationLevel: 0 }, now)).toBeNull();
    expect(escalationLevelDue({ status: "open", createdAt: new Date(now.getTime() - 60_000), escalationLevel: 0 }, now)).toBeNull();
  });
});
