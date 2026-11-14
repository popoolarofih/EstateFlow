/**
 * Grants (or revokes with --revoke) the `platformAdmin` custom claim. Platform administration is
 * deliberately not available from the web UI. Run with credentials for the target project:
 *
 *   npm run grant-platform-admin -- someone@example.com
 *   npm run grant-platform-admin -- someone@example.com --revoke
 */
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: grant-platform-admin <email> [--revoke]");
  process.exit(1);
}
const usingEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
if (!getApps().length) {
  initializeApp(usingEmulator ? { projectId: process.env.FIREBASE_PROJECT_ID } : { credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
}

async function main() {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email!);
  const claims = { ...(user.customClaims ?? {}) };
  if (flag === "--revoke") delete claims.platformAdmin;
  else claims.platformAdmin = true;
  await auth.setCustomUserClaims(user.uid, claims);
  // Existing sessions must end so the new claim set takes effect everywhere.
  await auth.revokeRefreshTokens(user.uid);
  console.log(`${flag === "--revoke" ? "Revoked" : "Granted"} platform admin for ${email}. They must sign in again.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
