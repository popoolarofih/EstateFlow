# EstateFlow

**The estate, under control.** A multi tenant estate operations platform for gated estates in
Nigeria: visitor passes verified at the gate, service charge invoices paid through Paystack with
provider verified receipts, a ledger every resident can read, maintenance tickets and emergency
alerts.

This repository is the web MVP described in the *EstateFlow Next.js + Firebase MVP Blueprint*
(v1.0, 14 November 2026): one responsive Next.js application with role based experiences for
Residents, Gate Security, Facility Managers and Exco, on Firebase Authentication, Cloud Firestore,
Cloud Storage, Cloud Functions (2nd gen) and App Check.

| Role             | Home                | What they do                                                                                    |
| ---------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| Resident         | `/resident`       | Invite guests, staff passes, pay dues, receipts, published ledger, maintenance, emergency alert |
| Gate security    | `/guard/verify`   | Six digit keypad and QR scan, Allow / Do not allow, entry and exit log, live emergencies        |
| Facility manager | `/admin/overview` | Units, invitations, CSV import, billing, expenses, maintenance triage, settings, exports        |
| Exco / Treasurer | `/admin/overview` | Collections and ledger oversight; approve and publish by assigned permission                    |
| Platform admin   | `/platform`       | Create estates and invite their first manager (custom claim, granted by script)                 |

## Quick start (local, fully on emulators)

Requirements: Node 22+, Java 21+ (for the Firestore emulator).

```bash
npm install
npm --prefix functions install
cp .env.example .env.local        # emulator defaults; no real credentials needed
npm run emulators:fresh            # terminal 1: Auth, Firestore, Storage, Functions, UI on :4000
npm run seed                       # terminal 2: two estates, one account per role
npm run dev                        # terminal 3: http://localhost:3000
```

Seeded accounts (password `EstateFlow!2026`):

| Account                | Email                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| Platform admin         | `platform@estateflow.test`                                               |
| Akobo Gardens (Ibadan) | `resident@akobo_gardens.test`, `guard@…`, `manager@…`, `exco@…` |
| Lekki Palms (Lagos)    | `resident@lekki_palms.test`, `guard@…`, `manager@…`, `exco@…`   |

Try the core loop: sign in as the Akobo resident, **Invite a guest**, then sign in as the Akobo
guard and type the code. Typing the same code as the Lekki guard is denied (tenant isolation).
For payments, set `PAYSTACK_SECRET_KEY` to a Paystack **test** key and point a Paystack test
webhook at `/api/webhooks/paystack` (for example through a tunnel).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (production builds use webpack; see `docs/operations.md`) |
| `npm run typecheck`, `npm run lint` | TypeScript and ESLint |
| `npm test` | Unit tests (domain logic, no emulator) |
| `npm run test:rules` | Firestore and Storage Security Rules tests, two estates, on emulators |
| `npm run test:integration` | Service tests against the Firestore emulator (passes, payments, ledger, isolation) |
| `npm run test:e2e` | Playwright on a production build with seeded emulators (run `npm run build` first) |
| `npm run test:all` | typecheck, lint, unit, rules and integration |
| `npm run seed` | Seed the emulators |
| `npm run grant-platform-admin -- email` | Grant (or `--revoke`) the platform admin claim |
| `npm run functions:build` | Bundle the scheduled Cloud Functions |
| `npm run check:secrets` | After a build, fail if any secret reached the browser bundle |

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a preinstalled Chromium instead of
`npx playwright install`.

## Architecture

A modular monolith. React components stay presentational; domain logic lives in server only
modules shared by route handlers and Cloud Functions.

```
src/
  app/                    App Router: (public) landing, sign in, join · (resident) · (guard) · (admin) · (platform)
    api/                  Route handlers (all mutations), Paystack webhook, files, exports, receipts
  components/             ui primitives, layout, resident, guard, admin, marketing
  lib/                    Pure domain logic and infrastructure
    auth/                 session cookies, RBAC matrix (permissions.ts), tenant context (authorize.ts)
    passes/ billing/ ledger/ maintenance/ emergency/ imports/ payments/
    api/handler.ts        One wrapper: origin check, App Check, auth, Zod, rate limit, errors
    firebase/             Admin SDK (server only) and browser SDK
  server/
    services/             Mutations with authorisation, transactions and audit events
    repositories/         Estate scoped read models for Server Components
    jobs/                 Idempotent jobs shared with Cloud Functions
functions/                Scheduled Cloud Functions (bundles ../src/server/jobs)
firestore.rules  storage.rules  firestore.indexes.json
tests/  unit · rules · integration · e2e
docs/   operations.md · landing-page-brief.md
```

### Security model (blueprint section 8)

- **Membership is the source of tenant access.** `estateMembers/{uid}_{estateId}` holds role,
  unit, gates and Exco permissions. Every request loads it on the server; the browser never
  supplies an estate id, role, unit, amount or status that the server trusts.
- **The Admin SDK bypasses rules**, so every service authorises explicitly (`can()` plus
  `assertSameEstate()`, which reports other estates' records as *not found*).
- **Firestore rules** protect direct browser reads (live emergency feeds, alert status) and deny
  every client write. Tested with two estates in `tests/rules`.
- **Sessions** are Firebase session cookies (`__session`, HTTP only, Secure, SameSite=Lax),
  minted only from a sign in less than five minutes old, verified with revocation checks.
  Logout, suspension and role changes revoke refresh tokens.
- **Pass codes** are cryptographically random, stored only as HMAC SHA256 keyed by a server secret
  and bound to the estate. Lookups are estate scoped through a code lock document; QR tokens are
  256 bit and stored hashed. Verification is rate limited per guard and per gate.
- **Payments**: the server creates the pending payment and initialises Paystack; the webhook
  signature is checked against the raw body; the transaction is independently confirmed with
  Paystack's Verify API; one Firestore transaction updates payment, invoice, ledger, receipt and
  audit log. Duplicate webhooks are no-ops. Redirects are never proof of payment.
- **Ledger**: drafts, approval (two distinct approvers above a threshold), publication; published
  entries are immutable and corrected with linked reversals. Postings are double entry.
- **Uploads** go through the server, validated by magic bytes, size and image dimensions, and are
  read through `/api/files`, which re-checks access to the owning record.
- **Audit log** entries are written in the same transaction as the change they describe.
- Money is integer kobo throughout. Timestamps are server timestamps.

### Decisions and deviations

- **Typeface: Manrope**, self hosted and preloaded, with Geist Mono only for codes and references.
  No allowed UI font includes the naira sign or Yoruba tone marks, so tiny Noto Sans subsets supply
  ₦, Ṣ ṣ, Ẹ ẹ, Ọ ọ and combining tone marks through `unicode-range` (see `src/app/globals.css`); an
  end to end test checks these never fall back to a system font.
- **Icons: Solar** (Linear for interface, Bold for active states, Bold Duotone for illustrations)
  through one tree shakeable module, `src/components/ui/icons.tsx`.
- **Landing hero**: a Morning / Night scene (blurred sky, house layer that sinks into live WebGL2
  fog and swaps time of day at the deepest point, colours mixed on one variable) driven by a single
  `requestAnimationFrame` clock, in `src/components/marketing/estate-hero.tsx`. The six scene photos
  are loaded from images.higgs.ai as specified; self host them under `public/` if that CDN is not
  under your control. The loop pauses off screen and the switch is instant with reduced motion. UI primitives are hand written accessible components in
  the shadcn/ui style (native `<dialog>`, labelled fields) rather than the generated library.
- **Next.js 16 Cache Components** are on. Authenticated content is request time
  (`connection()` in the session read) and streams behind Suspense skeletons.
- **No user facing AI** and **online only gate verification**, as the blueprint recommends for
  the first release. Signed offline QR passes are a later phase.
- **Notifications**: in app always, web push when `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is set; SMS and
  WhatsApp plug into the same `NotificationChannel` interface later.
- **Monitoring**: structured JSON logs compatible with Cloud Logging. Sentry is not wired in;
  add `@sentry/nextjs` with its own DSN when ready.
- **Paystack split settlement** is configuration only (subaccount code and flat charge per
  estate) and is off by default until the arrangement is approved in writing.
- **Landing page facts**: no testimonials, logos, statistics or prices are invented. Placeholders
  in `src/config/marketing.ts` stay hidden until real content is supplied
  (see `docs/landing-page-brief.md`). The privacy notice and terms contain `{{legal_entity}}` and
  `{{privacy_contact_email}}` placeholders that must be filled and legally reviewed.

## Pre launch checklist

The 20 point website launch checklist (privacy, HTTPS, consent, SEO, speed, accessibility,
spam protection, analytics, error monitoring...) is mapped to code and tests in
[`docs/launch-checklist.md`](docs/launch-checklist.md).

## Deployment

See [`docs/operations.md`](docs/operations.md) for Firebase project setup, environment variables,
deploying the web app (Vercel or Firebase App Hosting) and functions, backups, secret rotation,
data retention, incident response and the launch gates.
