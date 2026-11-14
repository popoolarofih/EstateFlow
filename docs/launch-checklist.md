# Pre launch website checklist

The 20 items from the "things to have Claude do before launching your website" list, how each is
handled in EstateFlow, and what verifies it. Item 20 was cut off in the source video; it is taken
here as error monitoring.

Automated checks: `npm run test:e2e` (`tests/e2e/launch-checklist.spec.ts`), `npm test`,
`npm run test:integration` and `npm run check:secrets` (after `npm run build`). All run in CI.

| # | Item | How it is handled | Verified by |
|---|---|---|---|
| 1 | Privacy policy page | `/privacy`, NDPA oriented, cookies and analytics section | Link and meta tests; fill `{{legal_entity}}` / `{{privacy_contact_email}}` before launch |
| 2 | Terms and conditions page | `/terms` | Link and meta tests; legal review required |
| 3 | Secrets off the frontend | `server-only` guards on every secret reader, no secret in any `NEXT_PUBLIC_*` variable, Firebase SDK lazy loaded | `npm run check:secrets` scans `.next/static` for secret values and key patterns (fails CI) |
| 4 | Force HTTPS | `src/proxy.ts` 308 redirects `http` to `https` in production; HSTS (2 years, preload) on every response | `tests/unit/proxy.test.ts`, security header e2e test |
| 5 | Cookie consent banner | Only essential cookies by default (no banner needed). Setting `NEXT_PUBLIC_GA_MEASUREMENT_ID` enables GA4, which loads only after Accept; banner plus "Cookie settings" footer link | e2e asserts no cookies without consent |
| 6 | Meta titles and descriptions | Title template, descriptions, canonical, Open Graph and X tags on public pages; app pages `noindex` | e2e meta test |
| 7 | Social preview image | `opengraph-image.tsx` and `twitter-image.tsx` (1200x630, Geist) | e2e fetches both, checks `image/png` |
| 8 | Favicon | `icon.svg`, `apple-icon.tsx` (180px PNG), web manifest | e2e checks each link returns 200 |
| 9 | Sitemap and robots.txt | `sitemap.ts`, `robots.ts` (app, API and invite paths disallowed), base URL falls back to Vercel's domain | e2e sitemap and robots test |
| 10 | Alt text on images | Every `<img>` has descriptive alt; decorative icons are `aria-hidden` | axe `image-alt` rules in the accessibility test |
| 11 | Compress images | No heavy images on the landing page (illustration is HTML/CSS). Uploaded photos are resized to 1600px and re-encoded as WebP in the browser, which also strips EXIF/GPS (`src/lib/images/compress.ts`) | Server still enforces type, size and dimensions (`src/lib/uploads.ts`, unit tested) |
| 12 | Check page load speed | Static prerendered landing page, no render blocking fonts, Firebase kept off public pages. Lighthouse mobile: Performance 100, LCP 0.9 s, TBT 60 ms, CLS 0 | e2e budget: LCP < 2.5 s, CLS < 0.1, TTFB < 800 ms |
| 13 | Fix colour contrast | Subtle text darkened to `#646d85` (4.8:1 on canvas); all pairs WCAG AA | axe WCAG 2.1 AA on every public page and the 404 |
| 14 | Mobile friendly | Mobile first layouts, 48px touch targets, bottom nav for residents | e2e at 390px: no sideways scroll, primary action in first screen, no clipped button text |
| 15 | Custom 404 page | Branded `not-found.tsx` with links home and to sign in | e2e 404 test |
| 16 | Fix broken links | Fixed: legal page nav linked to `#section` anchors that only exist on the homepage | e2e crawls public pages, checks every internal link and anchor |
| 17 | Form validation | Client validation with inline messages plus Zod on the server for every form and API route | e2e pilot form test, unit and integration tests |
| 18 | Spam protection | Pilot form: honeypot, time trap (drops submissions under 3 s), per IP rate limit, App Check when enforced | `tests/integration/spam.test.ts` |
| 19 | Set up analytics | Vercel Web Analytics (cookieless, automatic on Vercel) and optional GA4 after consent, public pages only; `pilot_request_submitted` conversion event with no personal data | Manual: enable Web Analytics in the Vercel dashboard |
| 20 | Error monitoring | `instrumentation.ts` `onRequestError` for server errors, error boundaries report browser crashes to `/api/client-errors`; structured logs plus optional `ERROR_ALERT_WEBHOOK_URL` alerts | Server errors land in Vercel / Cloud Logging |

## Before going live

- Enable Web Analytics in the Vercel project (and set `NEXT_PUBLIC_GA_MEASUREMENT_ID` only if you
  want GA4; the consent banner then appears automatically).
- Set `ERROR_ALERT_WEBHOOK_URL` to a Slack or similar incoming webhook.
- Replace the legal placeholders and have the privacy notice and terms reviewed.
- Set `APP_BASE_URL` to the final domain once it is connected (until then the Vercel domain is used).
