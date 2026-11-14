"use client";

import { SignOut, Warning } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { api, errorMessage } from "@/lib/api/client";
import { formatTime } from "@/lib/time";
import type { Gate } from "@/types/domain";
import { GatePicker } from "./gate-picker";
import { useGate } from "./use-gate";

export interface InsideVisit {
  id: string;
  guestName: string | null;
  unitLabel: string | null;
  passTypeLabel: string | null;
  occurredAt: Date;
  expectedDepartureAt: Date | null;
}

/** Visitors currently inside, with one tap check out and overdue flags. */
export function InsideList({ visits, gates, timezone }: { visits: InsideVisit[]; gates: Gate[]; timezone: string }) {
  const router = useRouter();
  const [gateId, setGateId] = useGate(gates);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  return (
    <section className="flex flex-col gap-3" aria-label="Visitors inside">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="heading-6">Inside now ({visits.length})</h2>
        <GatePicker gates={gates} gateId={gateId} onChange={setGateId} />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-white/10 p-3 body-5">
          {error}
        </p>
      )}
      {visits.length === 0 ? (
        <p className="rounded-2xl bg-white/5 p-4 body-6 text-white/70">Nobody is checked in right now.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visits.map((visit) => {
            const overdue = visit.expectedDepartureAt !== null && visit.expectedDepartureAt.getTime() < now;
            return (
              <li key={visit.id} className={cx("flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4", overdue ? "bg-gold text-navy" : "bg-white/10")}>
                <div className="flex flex-col gap-1">
                  <p className="title-2">
                    {visit.guestName ?? "Visitor"} · Unit {visit.unitLabel ?? "unknown"}
                  </p>
                  <p className="caption-1">
                    {visit.passTypeLabel} · in at {formatTime(visit.occurredAt, timezone)}
                    {overdue && visit.expectedDepartureAt && (
                      <span className="inline-flex items-center gap-1 body-4">
                        {" "}
                        <Warning size={16} aria-hidden /> Overdue since {formatTime(visit.expectedDepartureAt, timezone)}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pendingId === visit.id}
                  onClick={async () => {
                    setPendingId(visit.id);
                    setError(null);
                    try {
                      await api("/api/passes/exit", { json: { gateId, entryEventId: visit.id } });
                      router.refresh();
                    } catch (caught) {
                      setError(errorMessage(caught));
                    } finally {
                      setPendingId(null);
                    }
                  }}
                  className={cx(
                    "inline-flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 button-md transition duration-300 ease-weighted active:scale-[0.98]",
                    overdue ? "bg-navy text-white" : "bg-white text-navy",
                  )}
                >
                  <SignOut size={20} aria-hidden />
                  {pendingId === visit.id ? "Saving…" : "Check out"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
