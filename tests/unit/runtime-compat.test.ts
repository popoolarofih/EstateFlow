import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Vercel's Node runtime does not allow require() of ES modules. A dependency that does so (as
 * jwks-rsa 4 did with jose 6) crashes every server route that imports firebase-admin, so load each
 * module the app uses in a Node process with that feature disabled.
 */
const MODULES = [
  "firebase-admin/app",
  "firebase-admin/auth",
  "firebase-admin/app-check",
  "firebase-admin/firestore",
  "firebase-admin/storage",
  "firebase-admin/messaging",
];

describe("server dependencies load without require(esm)", () => {
  it.each(MODULES)("%s", (name) => {
    const output = execFileSync(process.execPath, ["--no-experimental-require-module", "-e", `require(${JSON.stringify(name)}); process.stdout.write("ok")`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(output).toBe("ok");
  });
});
