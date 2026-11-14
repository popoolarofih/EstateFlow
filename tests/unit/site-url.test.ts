import { afterEach, describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/site-url";

const KEYS = ["APP_BASE_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function set(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

describe("siteUrl", () => {
  it("uses APP_BASE_URL without a trailing slash", () => {
    set({ APP_BASE_URL: "https://app.estateflow.ng/" });
    expect(siteUrl()).toBe("https://app.estateflow.ng");
  });

  it("ignores a blank or malformed APP_BASE_URL and falls back to Vercel URLs", () => {
    set({ APP_BASE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "estateflow.vercel.app" });
    expect(siteUrl()).toBe("https://estateflow.vercel.app");
    set({ APP_BASE_URL: "not a url", VERCEL_URL: "estateflow-git-x.vercel.app" });
    expect(siteUrl()).toBe("https://estateflow-git-x.vercel.app");
  });

  it("falls back to localhost when nothing is configured", () => {
    set({});
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
