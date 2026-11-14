/** Collection names and deterministic document ids (blueprint section 7). */
export const COLLECTIONS = {
  users: "users",
  estates: "estates",
  estateSlugs: "estateSlugs",
  estateMembers: "estateMembers",
  units: "units",
  invites: "invites",
  visitorPasses: "visitorPasses",
  passCodes: "passCodes",
  gateEvents: "gateEvents",
  visitFlags: "visitFlags",
  billingRules: "billingRules",
  invoices: "invoices",
  payments: "payments",
  receipts: "receipts",
  webhookEvents: "webhookEvents",
  ledgerEntries: "ledgerEntries",
  maintenanceTickets: "maintenanceTickets",
  ticketEvents: "events",
  emergencyAlerts: "emergencyAlerts",
  notifications: "notifications",
  pushTokens: "pushTokens",
  auditLogs: "auditLogs",
  rateLimits: "rateLimits",
  imports: "imports",
  pilotRequests: "pilotRequests",
} as const;

/** Membership documents are keyed `{uid}_{estateId}` so rules can `get()` them directly. */
export function memberDocId(uid: string, estateId: string): string {
  return `${uid}_${estateId}`;
}
