/**
 * Structured JSON logger compatible with Google Cloud Logging (`severity`, `message`).
 * Never log secrets, raw pass codes, tokens or full provider payloads.
 */
type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

const REDACTED_KEYS = /(secret|token|password|authorization|code|cookie|key)$/i;

function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (REDACTED_KEYS.test(key) && key !== "errorCode") out[key] = "[redacted]";
    else if (value instanceof Error) out[key] = { name: value.name, message: value.message, stack: value.stack };
    else out[key] = value;
  }
  return out;
}

function write(severity: Severity, message: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test" && severity === "DEBUG") return;
  const entry = JSON.stringify({ severity, message, time: new Date().toISOString(), ...sanitize(fields) });
  if (severity === "ERROR") console.error(entry);
  else if (severity === "WARNING") console.warn(entry);
  else console.log(entry);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => write("DEBUG", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => write("INFO", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("WARNING", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write("ERROR", message, fields),
};
