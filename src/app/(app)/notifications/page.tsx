import { ArrowLeft, Bell } from "@/components/ui/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MarkAllReadButton } from "@/components/layout/mark-read-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ListSkeleton } from "@/components/ui/feedback";
import { List, ListRow } from "@/components/ui/list";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/authorize";
import { roleHome } from "@/lib/auth/permissions";
import { formatRelative } from "@/lib/time";
import { myNotifications } from "@/server/repositories";

export const metadata: Metadata = { title: "Notifications" };

async function Notifications() {
  const context = await requirePageContext();
  const notifications = await myNotifications(context);
  const now = new Date();
  const unread = notifications.filter((notification) => !notification.readAt).length;
  return (
    <>
      <Link href={roleHome(context.member.role)} className="inline-flex min-h-12 items-center gap-2 self-start rounded-lg button-sm text-violet-ink">
        <ArrowLeft size={18} aria-hidden /> Back
      </Link>
      <PageHeader title="Notifications" description={context.estate.name} actions={<MarkAllReadButton disabled={unread === 0} />} />
      {notifications.length === 0 ? (
        <EmptyState icon={<Bell size={24} />} title="You are all caught up" description="Visitor arrivals, invoices, payment confirmations and ticket updates will appear here." />
      ) : (
        <List label="Notifications">
          {notifications.map((notification) => (
            <ListRow
              key={notification.id}
              href={notification.link ?? undefined}
              leading={<Bell size={20} />}
              title={notification.title}
              meta={`${notification.body} · ${formatRelative(notification.createdAt, now)}`}
              trailing={
                <>
                  {notification.priority === "high" && <Badge tone="alert">Urgent</Badge>}
                  {!notification.readAt && <Badge tone="violet">New</Badge>}
                </>
              }
            />
          ))}
        </List>
      )}
    </>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} label="Loading notifications" />}>
      <Notifications />
    </Suspense>
  );
}
