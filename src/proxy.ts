import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for signed out visitors. This is not authorisation: every page and API
 * route verifies the session cookie and estate membership on the server.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("__session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/resident/:path*", "/guard/:path*", "/admin/:path*", "/platform/:path*", "/notifications/:path*"],
};
