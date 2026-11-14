import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileView } from "@/components/layout/profile-view";
import { ListSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Profile" };

async function Profile() {
  const context = await requirePageContext("pass.create");
  return <ProfileView context={context} />;
}

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" />
      <Suspense fallback={<ListSkeleton rows={3} label="Loading profile" />}>
        <Profile />
      </Suspense>
    </>
  );
}
