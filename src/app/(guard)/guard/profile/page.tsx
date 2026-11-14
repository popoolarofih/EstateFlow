import type { Metadata } from "next";
import { Suspense } from "react";
import { GuardSkeleton } from "@/components/guard/guard-skeleton";
import { ProfileView } from "@/components/layout/profile-view";
import { requirePageContext } from "@/lib/auth/authorize";

export const metadata: Metadata = { title: "Account" };

async function Profile() {
  const context = await requirePageContext("pass.verify");
  return (
    <div className="flex flex-col gap-6 text-ink">
      <ProfileView context={context} />
    </div>
  );
}

export default function GuardProfilePage() {
  return (
    <>
      <h1 className="heading-5">Account</h1>
      <Suspense fallback={<GuardSkeleton />}>
        <Profile />
      </Suspense>
    </>
  );
}
