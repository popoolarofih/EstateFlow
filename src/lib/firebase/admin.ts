import "server-only";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

/**
 * Firebase Admin SDK, server only. The Admin SDK bypasses Firestore and Storage Security
 * Rules, so every caller must authorise explicitly through `@/lib/auth/authorize`.
 */

const EMULATOR_VARIABLES = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"] as const;

/**
 * Emulator hosts copied into a deployed environment (e.g. from .env.example) would silently point
 * production at servers that do not exist. When deployed and not explicitly in emulator mode, they
 * are removed before the Admin SDK reads them.
 */
function ignoreStrayEmulatorVariables(): void {
  const deployed = process.env.VERCEL === "1" || process.env.K_SERVICE !== undefined;
  if (!deployed || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") return;
  const stray = EMULATOR_VARIABLES.filter((name) => process.env[name]);
  if (stray.length === 0) return;
  for (const name of stray) delete process.env[name];
  console.warn(JSON.stringify({ severity: "WARNING", message: "ignored emulator variables in a deployed environment", variables: stray }));
}

function usingEmulators(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function createApp(): App {
  ignoreStrayEmulatorVariables();
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (usingEmulators()) {
    return initializeApp({ projectId, storageBucket }, "estateflow-admin");
  }
  const credential = clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : applicationDefault();
  return initializeApp({ credential, projectId, storageBucket }, "estateflow-admin");
}

let firestore: Firestore | null = null;

export function adminApp(): App {
  return getApps().find((app) => app.name === "estateflow-admin") ?? createApp();
}

export function adminDb(): Firestore {
  if (!firestore) {
    firestore = getFirestore(adminApp());
    try {
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Separate server bundles share one Firestore instance per app; another bundle already
      // applied these same settings through this function.
    }
  }
  return firestore;
}

export const adminAuth = () => getAuth(adminApp());
export const adminStorage = () => getStorage(adminApp());
export const adminMessaging = () => getMessaging(adminApp());
export const adminAppCheck = () => getAppCheck(adminApp());
