/** Pure fixed window counter used by the Firestore backed rate limiter. */
export interface WindowState {
  windowStart: number;
  count: number;
}

export interface WindowDecision {
  allowed: boolean;
  next: WindowState;
  retryAfterSeconds: number;
}

export function consumeWindow(
  state: WindowState | null,
  now: number,
  limit: number,
  windowMs: number,
): WindowDecision {
  const current = state && now - state.windowStart < windowMs ? state : { windowStart: now, count: 0 };
  if (current.count >= limit) {
    return {
      allowed: false,
      next: current,
      retryAfterSeconds: Math.max(1, Math.ceil((current.windowStart + windowMs - now) / 1000)),
    };
  }
  return { allowed: true, next: { windowStart: current.windowStart, count: current.count + 1 }, retryAfterSeconds: 0 };
}
