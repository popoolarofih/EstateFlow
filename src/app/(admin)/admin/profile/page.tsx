import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileView } from "@/components/layout/profile-view";
import { PageSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Account" };

async function Profile() {
  const context = await requirePageContext("reports.view");
  return <ProfileView context={context} />;
}

export default function AdminProfilePage() {
  return (
    <>
      <PageHeader title="Account" />
      <Suspense fallback={<PageSkeleton />}>
        <Profile />
      </Suspense>
    </>
  );
}
