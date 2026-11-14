/**
 * Application errors carry a safe, actionable message for the user and an HTTP status.
 * Internal details stay in logs and never reach the client.
 */
export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "rate_limited"
  | "precondition_failed"
  | "provider_unavailable"
  | "not_configured"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  conflict: 409,
  rate_limited: 429,
  precondition_failed: 412,
  provider_unavailable: 503,
  not_configured: 503,
  internal: 500,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: { fieldErrors?: Record<string, string[]>; retryAfterSeconds?: number },
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const unauthenticated = () => new AppError("unauthenticated", "Sign in to continue.");
export const forbidden = (message = "You do not have permission to do that.") => new AppError("forbidden", message);
export const notFound = (message = "We could not find that record.") => new AppError("not_found", message);
export const conflict = (message: string) => new AppError("conflict", message);
export const precondition = (message: string) => new AppError("precondition_failed", message);

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
    retryAfterSeconds?: number;
  };
}
