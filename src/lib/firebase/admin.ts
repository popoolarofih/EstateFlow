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

function usingEmulators(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function createApp(): App {
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
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export const adminAuth = () => getAuth(adminApp());
export const adminStorage = () => getStorage(adminApp());
export const adminMessaging = () => getMessaging(adminApp());
export const adminAppCheck = () => getAppCheck(adminApp());
