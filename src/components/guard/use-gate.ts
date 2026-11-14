"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Gate } from "@/types/domain";

const STORAGE_KEY = "estateflow.gate";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // Storage can be unavailable in private mode.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Remembers which assigned gate this device is posted at (a per device convenience only). */
export function useGate(gates: Gate[]) {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const gateId = stored && gates.some((gate) => gate.id === stored) ? stored : (gates[0]?.id ?? "");
  const choose = useCallback((id: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Ignore storage failures; the selection simply is not remembered.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [gateId, choose] as const;
}
