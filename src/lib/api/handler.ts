import "server-only";
import { createHmac } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { connection, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { actorName, requireApiContext, type ActiveContext } from "@/lib/auth/authorize";
import type { Action } from "@/lib/auth/permissions";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import type { AuditActor } from "@/lib/audit/audit";
import { appCheckEnforced, appBaseUrl, passCodeSecret } from "@/lib/env";
import { AppError, forbidden, unauthenticated, type ApiErrorBody } from "@/lib/errors";
import { adminAppCheck, adminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";
import { enforceRateLimit, type RateLimitRule } from "@/lib/rate-limit";

/**
 * One wrapper for every route handler: same origin check, optional App Check, session and
 * membership authorisation, Zod validation, rate limiting, and consistent error responses.
 */

const MAX_JSON_BYTES = 256 * 1024;

type AuthMode = "member" | "user" | "platform" | "public";

interface BaseContext {
  request: NextRequest;
  params: Record<string, string>;
  meta: { ipHash: string | null; userAgent: string | null };
}

export interface MemberContext<B> extends BaseContext {
  body: B;
  user: SessionUser;
  context: ActiveContext;
  actor: AuditActor;
}

export interface UserContext<B> extends BaseContext {
  body: B;
  user: SessionUser;
  actor: AuditActor;
}

export interface PublicContext<B> extends BaseContext {
  body: B;
}

type BodyOf<S> = S extends z.ZodType ? z.output<S> : undefined;

interface RouteOptions<S extends z.ZodType | undefined, M extends AuthMode> {
  auth: M;
  action?: Action | readonly Action[];
  /** Require App Check on a public route too (when enforcement is on). */
  appCheck?: boolean;
  body?: S;
  /** Multipart routes parse `request.formData()` themselves. */
  multipart?: boolean;
  rateLimit?: (ctx: { ip: string; uid: string | null }) => [RateLimitRule, string];
}

type HandlerContext<S, M extends AuthMode> = M extends "member"
  ? MemberContext<BodyOf<S>>
  : M extends "user" | "platform"
    ? UserContext<BodyOf<S>>
    : PublicContext<BodyOf<S>>;

type RouteParams = { params: Promise<Record<string, string | string[]>> };

export function jsonError(error: AppError): NextResponse<ApiErrorBody> {
  const headers: Record<string, string> = {};
  if (error.details?.retryAfterSeconds) headers["Retry-After"] = String(error.details.retryAfterSeconds);
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        fieldErrors: error.details?.fieldErrors,
        retryAfterSeconds: error.details?.retryAfterSeconds,
      },
    },
    { status: error.status, headers },
  );
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof z.ZodError) {
    return new AppError("validation_failed", "Some fields need attention.", {
      fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
    });
  }
  return new AppError("internal", "Something went wrong on our side. Please try again.");
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function hashIp(ip: string): string | null {
  try {
    return createHmac("sha256", passCodeSecret()).update(ip).digest("hex").slice(0, 32);
  } catch {
    return null;
  }
}

/** Rejects cross site state changing requests (defence in depth on top of SameSite cookies). */
function assertSameOrigin(request: NextRequest): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) {
    // Browsers always send Origin on cross site POSTs; a missing header means same site or a non browser client.
    return;
  }
  const allowed = new Set([new URL(appBaseUrl()).origin, request.nextUrl.origin]);
  if (!allowed.has(origin)) throw forbidden("This request was blocked because it came from another site.");
}

async function assertAppCheck(request: NextRequest): Promise<void> {
  if (!appCheckEnforced()) return;
  const token = request.headers.get("x-firebase-appcheck");
  if (!token) throw new AppError("forbidden", "This app could not be verified. Refresh the page and try again.");
  try {
    await adminAppCheck().verifyToken(token);
  } catch {
    throw new AppError("forbidden", "This app could not be verified. Refresh the page and try again.");
  }
}

async function parseJsonBody<S extends z.ZodType>(request: NextRequest, schema: S): Promise<z.output<S>> {
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) throw new AppError("validation_failed", "The request is too large.");
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError("validation_failed", "The request body is not valid JSON.");
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw toAppError(parsed.error);
  return parsed.data;
}

export function apiRoute<S extends z.ZodType | undefined = undefined, M extends AuthMode = AuthMode>(
  options: RouteOptions<S, M>,
  handler: (ctx: HandlerContext<S, M>) => Promise<unknown>,
) {
  return async (request: NextRequest, routeContext: RouteParams): Promise<Response> => {
    const started = Date.now();
    let uid: string | null = null;
    // Every API response depends on the request (session, body, query); never prerender it.
    await connection();
    try {
      assertSameOrigin(request);
      if (options.auth !== "public" || options.appCheck) await assertAppCheck(request);

      const rawParams = routeContext?.params ? await routeContext.params : {};
      const params = Object.fromEntries(
        Object.entries(rawParams).map(([key, value]) => [key, Array.isArray(value) ? value.join("/") : value]),
      );
      const ip = clientIp(request);
      const meta = { ipHash: hashIp(ip), userAgent: request.headers.get("user-agent") };

      let user: SessionUser | null = null;
      let context: ActiveContext | null = null;
      if (options.auth === "member") {
        context = await requireApiContext(options.action);
        user = context.user;
      } else if (options.auth === "user" || options.auth === "platform") {
        user = await getSessionUser();
        if (!user) throw unauthenticated();
        if (options.auth === "platform" && !user.platformAdmin) throw forbidden();
      }
      uid = user?.uid ?? null;

      if (options.rateLimit) {
        const [rule, subject] = options.rateLimit({ ip, uid });
        await enforceRateLimit(adminDb(), rule, subject);
      }

      const body = options.body && !options.multipart ? await parseJsonBody(request, options.body) : undefined;
      const actor: AuditActor | undefined = user
        ? {
            uid: user.uid,
            name: context ? actorName(context) : user.email ?? "Platform admin",
            ipHash: meta.ipHash,
            userAgent: meta.userAgent,
          }
        : undefined;

      const result = await handler({ request, params, meta, body, user, context, actor } as unknown as HandlerContext<
        S,
        M
      >);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      // Let Next.js control flow errors (dynamic bail outs, redirects) propagate untouched.
      unstable_rethrow(error);
      const appError = toAppError(error);
      const fields = { method: request.method, path: request.nextUrl.pathname, uid, ms: Date.now() - started };
      if (appError.status >= 500) logger.error("api request failed", { ...fields, error });
      else logger.info("api request rejected", { ...fields, errorCode: appError.code });
      return jsonError(appError);
    }
  };
}
