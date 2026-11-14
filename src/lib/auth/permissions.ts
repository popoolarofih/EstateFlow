import type { EstateMember, GrantablePermission, Role } from "@/types/domain";

/**
 * RBAC matrix from the product blueprint (section 2). Authority always comes from the
 * server side membership document, never from client supplied values or email domains.
 */
export type Action =
  | "pass.create"
  | "pass.revoke.own"
  | "pass.revoke.any"
  | "pass.viewAll"
  | "pass.verify"
  | "gate.viewEvents"
  | "invoice.viewOwn"
  | "invoice.pay"
  | "invoice.viewAll"
  | "invoice.manage"
  | "billingRule.draft"
  | "billingRule.approve"
  | "payment.viewAll"
  | "payment.reverify"
  | "ledger.viewPublished"
  | "ledger.viewAll"
  | "ledger.draft"
  | "ledger.approve"
  | "ledger.publish"
  | "maintenance.create"
  | "maintenance.viewOwn"
  | "maintenance.viewAll"
  | "maintenance.manage"
  | "maintenance.comment"
  | "emergency.create"
  | "emergency.viewAll"
  | "emergency.acknowledge"
  | "emergency.resolve"
  | "units.manage"
  | "members.manage"
  | "residents.import"
  | "estate.settings"
  | "reports.view"
  | "reports.export"
  | "audit.view";

const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  resident: [
    "pass.create",
    "pass.revoke.own",
    "invoice.viewOwn",
    "invoice.pay",
    "ledger.viewPublished",
    "maintenance.create",
    "maintenance.viewOwn",
    "maintenance.comment",
    "emergency.create",
  ],
  guard: ["pass.verify", "gate.viewEvents", "emergency.viewAll", "emergency.acknowledge"],
  manager: [
    "pass.revoke.any",
    "pass.viewAll",
    "gate.viewEvents",
    "invoice.viewAll",
    "invoice.manage",
    "billingRule.draft",
    "payment.viewAll",
    "payment.reverify",
    "ledger.viewPublished",
    "ledger.viewAll",
    "ledger.draft",
    "maintenance.viewAll",
    "maintenance.manage",
    "maintenance.comment",
    "emergency.viewAll",
    "emergency.acknowledge",
    "emergency.resolve",
    "units.manage",
    "members.manage",
    "residents.import",
    "estate.settings",
    "reports.view",
    "reports.export",
    "audit.view",
  ],
  exco: [
    "pass.viewAll",
    "gate.viewEvents",
    "invoice.viewAll",
    "payment.viewAll",
    "ledger.viewPublished",
    "ledger.viewAll",
    "maintenance.viewAll",
    "emergency.viewAll",
    "reports.view",
    "reports.export",
    "audit.view",
  ],
};

/** Actions only granted through an explicit permission on an Exco membership. */
const GRANTED_ACTIONS: Record<GrantablePermission, Action> = {
  "ledger.approve": "ledger.approve",
  "ledger.publish": "ledger.publish",
  "billingRule.approve": "billingRule.approve",
};

type MemberLike = Pick<EstateMember, "role" | "status" | "permissions">;

export function can(member: MemberLike | null | undefined, action: Action): boolean {
  if (!member || member.status !== "active") return false;
  if (ROLE_ACTIONS[member.role].includes(action)) return true;
  if (member.role !== "exco") return false;
  return member.permissions.some((permission) => GRANTED_ACTIONS[permission] === action);
}

export function actionsFor(member: MemberLike): Action[] {
  const all = new Set<Action>();
  for (const action of Object.values(ROLE_ACTIONS).flat()) {
    if (can(member, action)) all.add(action);
  }
  for (const action of Object.values(GRANTED_ACTIONS)) {
    if (can(member, action)) all.add(action);
  }
  return [...all];
}

/** Where each role lands after sign in. */
export function roleHome(role: Role): string {
  switch (role) {
    case "resident":
      return "/resident";
    case "guard":
      return "/guard/verify";
    case "manager":
    case "exco":
      return "/admin/overview";
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  resident: "Resident",
  guard: "Gate security",
  manager: "Facility manager",
  exco: "Exco / Treasurer",
};
