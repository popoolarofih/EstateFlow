import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CreateEstateForm } from "@/components/admin/create-estate-form";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/feedback";
import { Table, Td, Th } from "@/components/ui/table";
import { getSessionUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { fromQuery } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { formatDate } from "@/lib/time";
import type { Estate } from "@/types/domain";

export const metadata: Metadata = { title: "Platform administration", robots: { index: false } };

async function Platform() {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (!user.platformAdmin) redirect("/no-access");
  const estates = fromQuery<Estate>(await adminDb().collection(COLLECTIONS.estates).orderBy("createdAt", "desc").limit(200).get());
  return (
    <>
      <Card>
        <CardHeader title="Onboard a new estate" description="Creates the estate and a one time invitation for its first facility manager." />
        <CreateEstateForm />
      </Card>
      <Card>
        <CardHeader title={`Estates (${estates.length})`} />
        <Table>
          <thead>
            <tr>
              <Th>Estate</Th>
              <Th>City</Th>
              <Th>Plan</Th>
              <Th>Created</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {estates.map((estate) => (
              <tr key={estate.id}>
                <Td>
                  <span className="title-4">{estate.name}</span>
                  <span className="block caption-2 text-muted">{estate.slug}</span>
                </Td>
                <Td>{estate.city}</Td>
                <Td>{estate.planId}</Td>
                <Td>{formatDate(estate.createdAt)}</Td>
                <Td>
                  <Badge tone={estate.status === "active" ? "teal" : "alert"}>{estate.status === "active" ? "Active" : "Suspended"}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

export default function PlatformPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Logo href="/platform" />
          <SignOutButton variant="ghost" />
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
        <h1 className="heading-5 md:heading-4">Platform administration</h1>
        <Suspense fallback={<PageSkeleton />}>
          <Platform />
        </Suspense>
      </main>
    </div>
  );
}
