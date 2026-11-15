"use client";

import type { ApiErrorBody, ErrorCode } from "@/lib/errors";

const APP_CHECK_ENABLED = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY);

/** Loads the Firebase SDK only when App Check is configured, keeping it off public pages otherwise. */
async function appCheckHeader(): Promise<string | null> {
  if (!APP_CHECK_ENABLED) return null;
  const { appCheckToken } = await import("@/lib/firebase/client");
  return appCheckToken();
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode | "network",
    readonly status: number,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

/** Typed fetch for the EstateFlow API with consistent, user safe error messages. */
export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = await appCheckHeader();
  if (token) headers["X-Firebase-AppCheck"] = token;
  let body: BodyInit | undefined;
  if (options.formData) body = options.formData;
  else if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      credentials: "same-origin",
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("You appear to be offline. Check your connection and try again.", "network", 0);
  }

  const data = (await response.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!response.ok) {
    const error = data?.error;
    throw new ApiError(
      error?.message ?? "Something went wrong. Please try again.",
      error?.code ?? "internal",
      response.status,
      error?.fieldErrors ?? {},
    );
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}
