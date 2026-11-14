import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/resident", "/guard", "/admin", "/platform", "/notifications"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Runs before every page and API request:
 * 1. Forces HTTPS in production (HSTS in next.config.ts then keeps browsers on HTTPS).
 * 2. Optimistically sends signed out visitors to sign in. This is not authorisation: every
 *    page and API route verifies the session cookie and estate membership on the server.
 */
export function proxy(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = request.nextUrl.hostname;
  if (process.env.NODE_ENV === "production" && forwardedProto === "http" && !LOCAL_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.port = "";
    // 308 keeps the method and body for API calls.
    return NextResponse.redirect(url, 308);
  }

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (isProtected && !request.cookies.has("__session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except build assets and static files.
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml|webmanifest|js)$).*)"],
};
