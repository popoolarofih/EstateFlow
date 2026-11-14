import { describe, expect, it } from "vitest";
import { can, roleHome, type Action } from "@/lib/auth/permissions";
import type { EstateMember } from "@/types/domain";

const member = (role: EstateMember["role"], overrides: Partial<EstateMember> = {}) => ({
  role,
  status: "active" as const,
  permissions: [] as EstateMember["permissions"],
  ...overrides,
});

describe("permission matrix (blueprint section 2)", () => {
  const matrix: [Action, boolean, boolean, boolean, boolean][] = [
    // action, resident, guard, manager, exco
    ["pass.create", true, false, false, false],
    ["pass.revoke.any", false, false, true, false],
    ["pass.verify", false, true, false, false],
    ["gate.viewEvents", false, true, true, true],
    ["invoice.viewOwn", true, false, false, false],
    ["invoice.pay", true, false, false, false],
    ["invoice.viewAll", false, false, true, true],
    ["invoice.manage", false, false, true, false],
    ["ledger.viewPublished", true, false, true, true],
    ["ledger.draft", false, false, true, false],
    ["ledger.approve", false, false, false, false],
    ["maintenance.create", true, false, false, false],
    ["maintenance.manage", false, false, true, false],
    ["maintenance.viewAll", false, false, true, true],
    ["emergency.create", true, false, false, false],
    ["emergency.acknowledge", false, true, true, false],
    ["emergency.viewAll", false, true, true, true],
    ["members.manage", false, false, true, false],
  ];

  it.each(matrix)("%s", (action, resident, guard, manager, exco) => {
    expect(can(member("resident"), action)).toBe(resident);
    expect(can(member("guard"), action)).toBe(guard);
    expect(can(member("manager"), action)).toBe(manager);
    expect(can(member("exco"), action)).toBe(exco);
  });

  it("never gives guards financial or resident data access", () => {
    for (const action of ["invoice.viewAll", "invoice.viewOwn", "payment.viewAll", "ledger.viewAll", "ledger.viewPublished", "units.manage", "reports.view"] as Action[]) {
      expect(can(member("guard"), action)).toBe(false);
    }
  });

  it("grants Exco approval and publishing only through assigned permissions", () => {
    const treasurer = member("exco", { permissions: ["ledger.approve", "ledger.publish"] });
    expect(can(treasurer, "ledger.approve")).toBe(true);
    expect(can(treasurer, "ledger.publish")).toBe(true);
    expect(can(treasurer, "billingRule.approve")).toBe(false);
    // Permissions on a non Exco membership are ignored.
    expect(can(member("manager", { permissions: ["ledger.approve"] }), "ledger.approve")).toBe(false);
  });

  it("denies everything to suspended or missing members", () => {
    expect(can(member("manager", { status: "suspended" }), "invoice.viewAll")).toBe(false);
    expect(can(member("resident", { status: "invited" }), "pass.create")).toBe(false);
    expect(can(null, "pass.create")).toBe(false);
  });

  it("routes each role to its home", () => {
    expect(roleHome("resident")).toBe("/resident");
    expect(roleHome("guard")).toBe("/guard/verify");
    expect(roleHome("exco")).toBe("/admin/overview");
  });
});
