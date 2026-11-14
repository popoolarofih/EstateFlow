import { Bell } from "@/components/ui/icons";
import Link from "next/link";
import { getActiveContext } from "@/lib/auth/authorize";
import { unreadNotificationCount } from "@/server/repositories";

/** Estate name and unread notification count; streamed behind a Suspense boundary. */
export async function HeaderStatus({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const context = await getActiveContext();
  if (!context) return null;
  const unread = await unreadNotificationCount(context);
  const text = tone === "dark" ? "text-ink" : "text-white";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <p className={`hidden truncate caption-1 sm:block ${tone === "dark" ? "text-muted" : "text-white/70"}`}>{context.estate.name}</p>
      <Link
        href="/notifications"
        className={`relative inline-flex size-12 items-center justify-center rounded-xl transition duration-300 ease-weighted ${
          tone === "dark" ? "hover:bg-navy/5" : "hover:bg-white/10"
        } ${text}`}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell size={24} aria-hidden />
        {unread > 0 && (
          <span className="absolute right-2 top-2 min-w-5 rounded-full bg-alert px-1 text-center caption-3 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </div>
  );
}
