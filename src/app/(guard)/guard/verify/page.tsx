import type { Metadata } from "next";
import { Suspense } from "react";
import { GateVerifier } from "@/components/guard/gate-verifier";
import { GuardSkeleton } from "@/components/guard/guard-skeleton";
import { LiveEmergencies } from "@/components/guard/live-emergencies";
import { requirePageContext } from "@/lib/auth/authorize";
import { emergencyFeed } from "@/server/repositories";

export const metadata: Metadata = { title: "Verify visitor" };

async function Verify() {
  const context = await requirePageContext("pass.verify");
  const gates = context.estate.gates.filter((gate) => context.member.gateIds.includes(gate.id));
  const alerts = (await emergencyFeed(context)).filter((alert) => alert.status !== "resolved");
  return (
    <>
      <LiveEmergencies
        estateId={context.estate.id}
        timezone={context.estate.timezone}
        initial={alerts.map(({ id, unitLabel, category, locationText, status, createdAt, acknowledgedByName, callbackPhone }) => ({
          id,
          unitLabel,
          category,
          locationText,
          status,
          createdAt,
          acknowledgedByName,
          callbackPhone,
        }))}
      />
      <h1 className="sr-only">Verify a visitor pass</h1>
      <GateVerifier gates={gates} timezone={context.estate.timezone} contacts={context.estate.emergencyContacts} />
    </>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<GuardSkeleton />}>
      <Verify />
    </Suspense>
  );
}
