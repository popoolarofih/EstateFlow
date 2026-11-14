/**
 * Money helpers. All amounts are integer kobo (1 naira = 100 kobo). Floating point
 * arithmetic is never used for currency values.
 */

export function assertKobo(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non negative integer number of kobo`);
  }
}

const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "symbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats kobo as naira without converting through floating point for large values. */
export function formatNaira(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(kobo);
  const naira = Math.trunc(abs / 100);
  const remainder = abs % 100;
  // Format the whole naira part, then splice the exact kobo digits in.
  const formatted = NAIRA.format(naira);
  const [whole] = formatted.split(".");
  return `${sign}${whole}.${String(remainder).padStart(2, "0")}`;
}

/**
 * Parses a user typed naira amount ("50,000", "₦1,250.5", "300.75") into kobo.
 * Returns null when the input is not a valid non negative amount with at most 2 decimals.
 */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "").replace(/^NGN/i, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const kobo = whole * 100 + fraction;
  return Number.isSafeInteger(kobo) ? kobo : null;
}

export function sumKobo(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    assertKobo(value);
    total += value;
  }
  if (!Number.isSafeInteger(total)) throw new RangeError("Total exceeds safe integer range");
  return total;
}

export function koboToNairaInput(kobo: number): string {
  const naira = Math.trunc(kobo / 100);
  const remainder = kobo % 100;
  return remainder === 0 ? String(naira) : `${naira}.${String(remainder).padStart(2, "0")}`;
}
