#!/usr/bin/env node
/**
 * Fails if anything secret reached the browser bundle (.next/static) after `next build`:
 * the actual values of server secrets in the environment, plus well known secret patterns.
 * Run: npm run build && npm run check:secrets
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".next/static";
if (!existsSync(ROOT)) {
  console.error("No .next/static directory. Run `npm run build` first.");
  process.exit(2);
}

const SECRET_ENV = ["PAYSTACK_SECRET_KEY", "PAYSTACK_WEBHOOK_SECRET", "PASS_CODE_HMAC_SECRET", "FIREBASE_PRIVATE_KEY", "FIREBASE_CLIENT_EMAIL", "ERROR_ALERT_WEBHOOK_URL"];
const values = SECRET_ENV.map((name) => [name, process.env[name]?.trim()]).filter(([, value]) => value && value.length >= 8);

const PATTERNS = [
  ["Paystack secret key", /sk_(live|test)_[A-Za-z0-9]{10,}/],
  ["Private key block", /-----BEGIN (RSA |EC )?PRIVATE KEY-----/],
  ["Service account JSON", /"private_key_id"\s*:/],
  ["Server only env name", /process\.env\.(PAYSTACK_SECRET_KEY|PASS_CODE_HMAC_SECRET|FIREBASE_PRIVATE_KEY)/],
];

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|mjs|css|json|map|html|txt)$/.test(entry)) yield path;
  }
}

const findings = [];
let scanned = 0;
for (const path of files(ROOT)) {
  scanned += 1;
  const text = readFileSync(path, "utf8");
  for (const [name, value] of values) if (text.includes(value)) findings.push(`${path}: value of ${name}`);
  for (const [label, pattern] of PATTERNS) if (pattern.test(text)) findings.push(`${path}: ${label}`);
}

if (findings.length) {
  console.error(`Secrets found in the browser bundle:\n  ${findings.join("\n  ")}`);
  process.exit(1);
}
console.log(`No secrets in the browser bundle (${scanned} files scanned, ${values.length} secret values checked).`);
