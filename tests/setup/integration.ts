// Integration tests run inside `firebase emulators:exec`, which sets the emulator host variables.
process.env.FIREBASE_PROJECT_ID ??= "demo-estateflow";
process.env.FIREBASE_STORAGE_BUCKET ??= "demo-estateflow.appspot.com";
process.env.PASS_CODE_HMAC_SECRET ??= "integration-secret-integration-secret-00";
process.env.APP_BASE_URL ??= "http://localhost:3000";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Integration tests must run against the Firestore emulator (npm run test:integration).");
}
