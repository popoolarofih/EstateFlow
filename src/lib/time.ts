/** Timezone aware helpers. Estates default to Africa/Lagos (UTC+1, no DST). */

export const DEFAULT_TIMEZONE = "Africa/Lagos";

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutesOfDay: number;
  dateKey: string;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

export function zonedParts(date: Date, timezone: string): ZonedParts {
  const parts = Object.fromEntries(
    formatterFor(timezone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    year,
    month,
    day,
    weekday: WEEKDAYS[parts.weekday as string] ?? 0,
    minutesOfDay: hour * 60 + minute,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Parses "HH:MM" into minutes since midnight. Throws on malformed input. */
export function parseClock(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`Invalid time "${value}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

const displayFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function formatDateTime(date: Date | null | undefined, timezone = DEFAULT_TIMEZONE): string {
  if (!date) return "";
  const key = `dt:${timezone}`;
  let formatter = displayFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-NG", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    displayFormatterCache.set(key, formatter);
  }
  return formatter.format(date);
}

export function formatDate(date: Date | null | undefined, timezone = DEFAULT_TIMEZONE): string {
  if (!date) return "";
  const key = `d:${timezone}`;
  let formatter = displayFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-NG", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    displayFormatterCache.set(key, formatter);
  }
  return formatter.format(date);
}

export function formatTime(date: Date | null | undefined, timezone = DEFAULT_TIMEZONE): string {
  if (!date) return "";
  const key = `t:${timezone}`;
  let formatter = displayFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-NG", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
    displayFormatterCache.set(key, formatter);
  }
  return formatter.format(date);
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelative(date: Date, now = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return RELATIVE.format(seconds, "second");
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return RELATIVE.format(Math.round(seconds / 3600), "hour");
  return RELATIVE.format(Math.round(seconds / 86_400), "day");
}
