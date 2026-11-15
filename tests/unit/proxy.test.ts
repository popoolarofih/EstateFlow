import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

function request(url: string, headers: Record<string, string> = {}, cookie?: string) {
  const init = { headers: new Headers({ ...headers, ...(cookie ? { cookie } : {}) }) };
  return new NextRequest(url, init);
}

afterEach(() => vi.unstubAllEnvs());

describe("proxy", () => {
  it("forces HTTPS in production with a permanent redirect", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = proxy(request("http://estateflow.ng/resident?x=1", { "x-forwarded-proto": "http" }));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://estateflow.ng/resident?x=1");
  });

  it("never redirects partial prerendering resume requests, and leaves HTTPS to Vercel there", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(proxy(request("http://estateflow.ng/sign-in", { "x-forwarded-proto": "http", "next-resume": "1" })).headers.get("location")).toBeNull();
    vi.stubEnv("VERCEL", "1");
    expect(proxy(request("http://estateflow.ng/", { "x-forwarded-proto": "http" })).headers.get("location")).toBeNull();
  });

  it("does not redirect HTTPS, local hosts or development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(proxy(request("https://estateflow.ng/", { "x-forwarded-proto": "https" })).headers.get("location")).toBeNull();
    expect(proxy(request("http://localhost:3000/", { "x-forwarded-proto": "http" })).headers.get("location")).toBeNull();
    vi.stubEnv("NODE_ENV", "development");
    expect(proxy(request("http://estateflow.ng/", { "x-forwarded-proto": "http" })).headers.get("location")).toBeNull();
  });

  it("sends signed out visitors of protected areas to sign in, and leaves public pages alone", () => {
    const redirected = proxy(request("https://estateflow.ng/admin/billing"));
    expect(redirected.headers.get("location")).toBe("https://estateflow.ng/sign-in?next=%2Fadmin%2Fbilling");
    expect(proxy(request("https://estateflow.ng/admin/billing", {}, "__session=abc")).headers.get("location")).toBeNull();
    expect(proxy(request("https://estateflow.ng/")).headers.get("location")).toBeNull();
    expect(proxy(request("https://estateflow.ng/administrator")).headers.get("location")).toBeNull();
  });
});
