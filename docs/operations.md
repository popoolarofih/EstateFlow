# EstateFlow operations runbook

## 1. Environments

Use three separate Firebase projects. Never share credentials between them and never use live
Paystack keys outside production.

| Environment | Firebase project | Paystack key | Notes |
|---|---|---|---|
| Local | `demo-estateflow` (emulators only) | none or `sk_test_` | `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` |
| Staging | `estateflow-staging` | `sk_test_` | Pilot rehearsals, training |
| Production | `estateflow-production` | `sk_live_` | Only after the launch gates in section 8 |

Project aliases are in `.firebaserc`; select with `firebase use staging|production`.

## 2. Firebase project setup

1. Create the project and choose the Firestore location before launch (it cannot be changed).
   Keep Cloud Functions in a nearby region (`europe-west1` is configured in `functions/src/index.ts`).
2. **Authentication**: enable Email/Password and Phone. Add the app domains to Authorized domains.
   Enable multi factor authentication for manager, Exco and platform admin accounts.
3. **Firestore**: production mode. Deploy rules and indexes:
   `firebase deploy --only firestore:rules,firestore:indexes,storage`.
4. **Storage**: default bucket; rules deny all client writes.
5. **App Check**: register the web app with reCAPTCHA Enterprise, set
   `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`, monitor valid traffic in the console, then set
   `APP_CHECK_ENFORCE=true` on the server and enforce for Firestore and Storage.
6. **Web push** (optional): create a VAPID key pair under Cloud Messaging and set
   `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
7. Create the first platform admin: they sign up through any invitation or the console, then run
   `npm run grant-platform-admin -- their@email` with Application Default Credentials for the project.

## 3. Environment variables

All names are in `.env.example`. Server secrets:

| Variable | Store in | Notes |
|---|---|---|
| `PASS_CODE_HMAC_SECRET` | Vercel / App Hosting secret | 32+ random bytes (`openssl rand -base64 48`) |
| `PAYSTACK_SECRET_KEY` | secret | Also signs webhooks |
| `PAYSTACK_WEBHOOK_SECRET` | secret | Optional; defaults to the secret key |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | secret, only where ADC is unavailable | Prefer workload identity / ADC |

Never put secrets in Firestore, `NEXT_PUBLIC_*` variables or the repository.

## 4. Deploying

### Vercel checklist

- Build command: leave the default (`npm run build`, which runs `next build --webpack`; see below).
- Set these variables for Production (and Preview if you use it). Copy names from `.env.example`
  but **never** the emulator lines: do not set `FIRESTORE_EMULATOR_HOST`,
  `FIREBASE_AUTH_EMULATOR_HOST` or `FIREBASE_STORAGE_EMULATOR_HOST`, and set
  `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`.
  - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
    `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`,
    `NEXT_PUBLIC_FIREBASE_APP_ID` (Firebase console > Project settings > Your apps > Web app).
  - `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
    from a service account key (Vercel has no Google Application Default Credentials). Paste the
    private key with its `\n` escapes on one line.
  - `PASS_CODE_HMAC_SECRET` (32+ random characters), `PAYSTACK_SECRET_KEY` when payments go live,
    and `APP_BASE_URL` once a custom domain is connected.
  - `PLATFORM_ADMIN_UIDS`: your Firebase Auth user UID, to reach `/platform` and create estates.
- Check `https://<domain>/api/health` after each deploy: it reports module load errors and which
  settings are missing (yes/no only).
- In Firebase Authentication > Settings > Authorized domains, add the Vercel domain.
- Redeploy after changing variables (`NEXT_PUBLIC_*` values are baked in at build time).

### Why jwks-rsa is pinned

Vercel's Node runtime does not allow `require()` of ES modules. `firebase-admin` depends on
`jwks-rsa` 4, which requires the ESM only `jose` 6, so every route that imported
`firebase-admin/auth` crashed with `ERR_REQUIRE_ESM`. An npm override pins `jwks-rsa` 3.2.2
(same API, CommonJS `jose` 4). `tests/unit/runtime-compat.test.ts` guards this.

### Why production builds use webpack

Turbopack (the Next.js 16 default) loads server external packages such as `firebase-admin`
through hashed symlinks in `.next/node_modules`. Those links were not present in the deployed
Vercel functions, so every server rendered page and API route crashed with an empty 500 (sign in
stayed on its loading skeleton). `next build --webpack` references externals with plain
`require()` calls that Vercel's file tracing handles. Development (`next dev`) still uses Turbopack;
Tailwind runs through PostCSS for both.


**Web app** (Vercel or Firebase App Hosting): build command `npm run build`, Node 22. Set every
variable from section 3 plus the `NEXT_PUBLIC_FIREBASE_*` values and `APP_BASE_URL`. Ensure the
`FIRESTORE_EMULATOR_HOST` family of variables is **not** set in deployed environments.

**Functions**: `npm --prefix functions install && firebase deploy --only functions`. The
predeploy hook bundles `functions/src/index.ts` together with `src/server/jobs`.

| Function | Schedule (Africa/Lagos) | Purpose |
|---|---|---|
| `generateInvoices` | 06:00 on the 1st | Monthly (and quarterly on quarter starts) invoices for estates with automatic generation on |
| `invoiceReminders` | 07:00 daily | Mark overdue, remind three days before due |
| `expireVisitorPasses` | every 15 min | Expire passes and release code locks |
| `escalateEmergencyAlerts` | every minute | Escalate unacknowledged alerts at 2 and 5 minutes |
| `overdueVisitors` | every 15 min | Flag contractors and deliveries still inside |
| `cleanup` | 03:00 daily | Delete expired rate limit windows |

All jobs are idempotent; retries and overlapping runs are safe.

**Paystack**: set the webhook URL to `https://<domain>/api/webhooks/paystack` and the callback to
`https://<domain>/resident/payments/return`. Confirm subaccount eligibility, fee bearer and
settlement with Paystack and the estate in writing before enabling a subaccount in Settings.

## 5. Backups and restore

- Enable Firestore point in time recovery (7 days) and a daily scheduled export to a bucket in a
  separate project with object versioning and a 90 day lifecycle rule:
  `gcloud firestore export gs://<backup-bucket>/$(date +%F)`.
- Enable Storage object versioning on the default bucket.
- Rehearse a restore into staging each quarter: `gcloud firestore import gs://<backup-bucket>/<date>`.

## 6. Secret rotation

| Secret | How | Impact |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | Generate a new key in Paystack, update the secret, redeploy, then revoke the old key | Webhooks signed with the old key fail until redeployed; Paystack retries |
| `PASS_CODE_HMAC_SECRET` | Update and redeploy | All active six digit codes stop resolving (QR passes keep working). Announce, or rotate overnight when few passes are active |
| Service account keys | Prefer ADC; if keys exist, create a new key, deploy, delete the old key | None |

Rotate immediately if a secret may have been exposed, and at least every 12 months.

## 7. Data retention and privacy (NDPA)

Complete the NDPA review, data processing agreements with each estate, and fill the
`{{legal_entity}}` / `{{privacy_contact_email}}` placeholders before going live. Proposed defaults
to confirm with counsel:

| Data | Retention |
|---|---|
| Gate events, visitor names and phones | 12 months, then delete |
| Expired or revoked visitor passes | 90 days after expiry, then delete |
| Invoices, payments, receipts, ledger, audit logs | 7 years (financial records) |
| Maintenance tickets and photos | 24 months after closure |
| Emergency alerts | 24 months |
| Pilot requests | 12 months or until converted |

Implement deletions as an additional scheduled function once the policy is approved. Subject
access requests are handled by exporting the member's records by uid.

## 8. Incident response

1. **Detect**: Cloud Logging alerts on `severity=ERROR` spikes, `paystack webhook failed`,
   `payment.flagged` audit events and `emergencies escalated` warnings.
2. **Triage**: assign an incident owner; record the timeline in the incident channel.
3. **Contain**:
   - Lost or stolen guard device: suspend the guard in Settings (ends every session), then
     reactivate once the device is recovered or replaced.
   - Compromised account: suspend the membership; in the Firebase console disable the user.
   - Suspected pass code abuse: rotate `PASS_CODE_HMAC_SECRET` (section 6) and review denied
     gate events in the audit export.
   - Payment anomaly: review flagged payments in Billing > Payments; use *Check with provider*;
     never edit payment or invoice documents by hand.
4. **Communicate**: notify affected estates; for personal data breaches notify the NDPC within
   72 hours as required by the NDPA.
5. **Recover and review**: restore from backups if needed; write a blameless review.

Emergency alerts never replace national emergency services (112). Each estate must configure its
emergency contacts in Settings and test them with its personnel before go live.

## 9. Launch gates (blueprint section 17)

Do not go live until every item is true:

- [ ] `npm run test:all` and `npm run test:e2e` pass on the release commit (two estate isolation
      for every collection and server endpoint).
- [ ] Payment webhook signature, idempotency, mismatch and reconciliation tests pass, and a full
      test mode payment has been completed on staging.
- [ ] Pass code rate limits, replay and expiry behaviour verified on staging.
- [ ] Guard device loss and account disablement procedure (section 8) rehearsed.
- [ ] Emergency contacts configured and tested with estate personnel.
- [ ] Backups, logging alerts, support ownership, incident contacts and rollback plan in place.
- [ ] Estate account or subaccount ownership and payment flow approved in writing by the estate
      and Paystack.
- [ ] NDPA review complete; privacy notice and terms placeholders replaced and reviewed.
- [ ] App Check enforced after monitoring.

## 10. Known limitations

- Offline gate verification is not supported; the guard screen shows *Connection lost* and asks
  for a supervisor. Signed offline QR passes are a later phase.
- Rate limiting is Firestore backed (no Redis); very busy gates may see brief contention.
- The Storage rules test that uses cross service `firestore.get()` is skipped when `HTTPS_PROXY`
  is set, because the Firebase CLI routes emulator to emulator calls through the proxy and
  ignores `NO_PROXY`. It runs in normal local and CI environments.
