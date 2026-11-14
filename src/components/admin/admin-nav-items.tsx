import { getActiveContext } from "@/lib/auth/authorize";
import { can, type Action } from "@/lib/auth/permissions";
import { AdminMobileNav, AdminSideNav, type AdminNavKey } from "./admin-nav";

const REQUIRED: Record<AdminNavKey, Action[]> = {
  overview: ["reports.view"],
  units: ["units.manage", "members.manage"],
  billing: ["invoice.viewAll"],
  ledger: ["ledger.viewAll"],
  maintenance: ["maintenance.viewAll"],
  emergencies: ["emergency.viewAll"],
  audit: ["audit.view"],
  settings: ["estate.settings"],
  profile: ["reports.view"],
};

async function allowedKeys() {
  const context = await getActiveContext();
  if (!context) return { keys: [] as AdminNavKey[], estateName: "" };
  const keys = (Object.keys(REQUIRED) as AdminNavKey[]).filter((key) => REQUIRED[key].some((action) => can(context.member, action)));
  return { keys, estateName: context.estate.name };
}

/** Navigation filtered by the member's permissions; streamed so the page shell is not blocked. */
export async function AdminSideNavItems() {
  const { keys, estateName } = await allowedKeys();
  return (
    <div className="flex flex-col gap-4">
      <p className="truncate px-3 caption-1 text-white/60">{estateName}</p>
      <AdminSideNav allowed={keys} />
    </div>
  );
}

export async function AdminMobileNavItems() {
  const { keys, estateName } = await allowedKeys();
  return <AdminMobileNav allowed={keys} estateName={estateName} />;
}
