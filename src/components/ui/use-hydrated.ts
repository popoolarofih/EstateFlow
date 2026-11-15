"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/** False in server HTML and until React has hydrated, then true. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
