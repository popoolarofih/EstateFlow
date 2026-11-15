import { Users } from "@/components/ui/icons";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PassList } from "@/components/resident/pass-list";
import { PassManager } from "@/components/resident/pass-manager";
import { EmptyState, ListSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageContext } from "@/lib/auth/authorize";
import { unitPasses } from "@/server/repositories";

export const metadata: Metadata = { title: "Visitors" };

async function Visitors({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [context, params] = await Promise.all([requirePageContext("pass.create"), searchParams]);
  const passes = await unitPasses(context);
  const active = passes.filter((pass) => pass.status === "active");
  const past = passes.filter((pass) => pass.status !== "active");
  const rows = (list: typeof passes) =>
    list.map(({ id, guestName, passType, status, validFrom, validUntil, recurrence, useCount, lastUsedAt }) => ({
      id,
      guestName,
      passType,
      status,
      validFrom,
      validUntil,
      recurrence,
      useCount,
      lastUsedAt,
    }));

  return (
    <>
      <PageHeader
        title="Visitors"
        description="One time passes for guests, deliveries and contractors, and repeating passes for domestic staff."
        actions={
          <PassManager
            estateName={context.estate.name}
            gates={context.estate.gates}
            timezone={context.estate.timezone}
            startOpen={params.new === "1"}
          />
        }
      />
      <section className="flex flex-col gap-3">
        <h2 className="heading-6 text-ink">Active passes</h2>
        {active.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="No active passes"
            description="Create a pass and share the six digit code or QR with your visitor before they arrive."
          />
        ) : (
          <PassList passes={rows(active)} timezone={context.estate.timezone} canRevoke />
        )}
      </section>
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="heading-6 text-ink">Past passes</h2>
          <PassList passes={rows(past)} timezone={context.estate.timezone} canRevoke={false} />
        </section>
      )}
    </>
  );
}

export default function VisitorsPage({ searchParams }: PageProps<"/resident/visitors">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} label="Loading passes" />}>
      <Visitors searchParams={searchParams} />
    </Suspense>
  );
}
