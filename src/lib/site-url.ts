/**
 * The public base URL of the app, without a trailing slash. Empty or malformed values are ignored
 * (a blank `APP_BASE_URL` in a hosting dashboard must not break the build), falling back to the
 * URLs Vercel provides, then to localhost for development.
 */
function normalize(value: string | undefined, assumeHttps = false): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : assumeHttps ? `https://${trimmed}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return null;
  }
}

export function siteUrl(): string {
  return (
    normalize(process.env.APP_BASE_URL) ??
    normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL, true) ??
    normalize(process.env.VERCEL_URL, true) ??
    "http://localhost:3000"
  );
}
