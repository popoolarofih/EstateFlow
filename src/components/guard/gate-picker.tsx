"use client";

import type { Gate } from "@/types/domain";

export function GatePicker({ gates, gateId, onChange }: { gates: Gate[]; gateId: string; onChange: (id: string) => void }) {
  if (gates.length <= 1) {
    return <p className="caption-1 text-white/70">{gates[0]?.name ?? "No gate assigned"}</p>;
  }
  return (
    <label className="flex items-center gap-2 caption-1 text-white/70">
      <span>Gate</span>
      <select
        value={gateId}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-xl border border-white/20 bg-navy-soft px-3 py-2 body-5 text-white"
      >
        {gates.map((gate) => (
          <option key={gate.id} value={gate.id}>
            {gate.name}
          </option>
        ))}
      </select>
    </label>
  );
}
