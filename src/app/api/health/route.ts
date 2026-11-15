import { NextResponse } from "next/server";
import { connection } from "next/server";

/**
 * Deployment health check. Loads each server dependency inside try/catch (never statically, so a
 * broken dependency is reported instead of crashing this route) and reports which required
 * settings are present. Only booleans and error messages are returned, never configuration values.
 */
const REQUIRED = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "PASS_CODE_HMAC_SECRET",
] as const;

/** These must NOT be set in a deployed environment. */
const MUST_BE_UNSET = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"] as const;

async function check(name: string, load: () => Promise<unknown>) {
  try {
    await load();
    return { name, ok: true };
  } catch (error) {
    const err = error as Error & { code?: string };
    return { name, ok: false, error: `${err.code ? `${err.code}: ` : ""}${err.message}`.slice(0, 500) };
  }
}

export async function GET() {
  await connection();
  const modules = await Promise.all([
    check("firebase-admin/app", () => import("firebase-admin/app")),
    check("firebase-admin/auth", () => import("firebase-admin/auth")),
    check("firebase-admin/firestore", () => import("firebase-admin/firestore")),
    check("firebase-admin/storage", () => import("firebase-admin/storage")),
    check("firebase-admin/app-check", () => import("firebase-admin/app-check")),
    check("firebase-admin/messaging", () => import("firebase-admin/messaging")),
    check("session module", () => import("@/lib/auth/session")),
    check("api handler module", () => import("@/lib/api/handler")),
  ]);
  const privateKey = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const body = {
    ok: modules.every((module) => module.ok),
    node: process.version,
    modules,
    settings: Object.fromEntries(REQUIRED.map((name) => [name, Boolean(process.env[name]?.trim())])),
    privateKeyLooksValid: privateKey.includes("BEGIN PRIVATE KEY") && (privateKey.includes("\\n") || privateKey.includes("\n")),
    emulatorVariablesSet: MUST_BE_UNSET.filter((name) => Boolean(process.env[name])),
    emulatorsFlag: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS ?? null,
    platformAdminBootstrap: Boolean(process.env.PLATFORM_ADMIN_UIDS?.trim()),
  };
  return NextResponse.json(body, { status: body.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
