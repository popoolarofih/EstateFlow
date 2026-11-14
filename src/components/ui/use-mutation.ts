"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { ApiError, errorMessage } from "@/lib/api/client";

/**
 * Runs an API mutation, exposes pending / error / field error state, and refreshes the
 * Server Components on success so the page shows the authoritative server state.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: { refresh?: boolean; onSuccess?: (result: TResult) => void } = {},
) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const { refresh = true, onSuccess } = options;

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setPending(true);
      setError(null);
      setFieldErrors({});
      try {
        const result = await action(...args);
        onSuccess?.(result);
        if (refresh) startTransition(() => router.refresh());
        return result;
      } catch (caught) {
        setError(errorMessage(caught));
        if (caught instanceof ApiError) setFieldErrors(caught.fieldErrors);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [action, onSuccess, refresh, router],
  );

  return {
    run,
    pending: pending || refreshing,
    error,
    fieldErrors,
    fieldError: (name: string) => fieldErrors[name]?.[0],
    reset: () => {
      setError(null);
      setFieldErrors({});
    },
  };
}
