import type { Metadata } from "next";
import { Suspense } from "react";
import { GuardSkeleton } from "@/components/guard/guard-skeleton";
import { InsideList } from "@/components/guard/inside-list";
import { requirePageContext } from "@/lib/auth/authorize";
import { PASS_TYPE_LABELS } from "@/lib/labels";
import { guardMessage } from "@/lib/passes/evaluate";
import { formatTime } from "@/lib/time";
import { gateActivity } from "@/server/repositories";

export const metadata: Metadata = { title: "Gate activity" };

async function Activity() {
  const context = await requirePageContext("pass.verify");
  const gates = context.estate.gates.filter((gate) => context.member.gateIds.includes(gate.id));
  const { events, inside } = await gateActivity(context, gates.map((gate) => gate.id));
  const gateNames = new Map(gates.map((gate) => [gate.id, gate.name]));
  const tz = context.estate.timezone;
  return (
    <>
      <h1 className="heading-5">Gate activity</h1>
      <InsideList
        gates={gates}
        timezone={tz}
        visits={inside.map((event) => ({
          id: event.id,
          guestName: event.guestName,
          unitLabel: event.unitLabel,
          passTypeLabel: event.passType ? PASS_TYPE_LABELS[event.passType] : null,
          occurredAt: event.occurredAt,
          expectedDepartureAt: event.expectedDepartureAt,
        }))}
      />
      <section className="flex flex-col gap-3" aria-label="Recent events">
        <h2 className="heading-6">Last 24 hours</h2>
        {events.length === 0 ? (
          <p className="rounded-2xl bg-white/5 p-4 body-6 text-white/70">No gate events yet today.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/10 rounded-2xl bg-white/5">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex flex-col">
                  <p className="title-3">
                    {event.eventType === "exit" ? "Exit" : event.result === "allow" ? "Entry allowed" : guardMessage(event.reason === "exit_recorded" ? "valid" : event.reason).headline}
                    {event.guestName ? ` · ${event.guestName}` : ""}
                  </p>
                  <p className="caption-2 text-white/70">
                    {formatTime(event.occurredAt, tz)} · {gateNames.get(event.gateId) ?? event.gateId}
                    {event.unitLabel ? ` · Unit ${event.unitLabel}` : ""} · {event.guardName}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 caption-3 ${event.result === "allow" ? "bg-teal text-navy" : "bg-alert text-white"}`}>
                  {event.result === "allow" ? "Allowed" : "Denied"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<GuardSkeleton />}>
      <Activity />
    </Suspense>
  );
}
