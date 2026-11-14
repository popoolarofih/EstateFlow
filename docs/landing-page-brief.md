# Landing page brief

Produced with the `landing-page-design` skill (Part A) before the page was built. Facts that the
team has not yet supplied are kept out of the page rather than invented (see "Open inputs").

## Intake (assumptions stated, nothing invented)

| Question | Answer used |
|---|---|
| Primary action | Request a pilot walkthrough (form at `#pilot`, stored in `pilotRequests`) |
| Offer | A guided pilot: estate setup, resident import, guard and manager onboarding |
| Conversion | A valid pilot request submitted |
| ICP | Estate chairmen, Exco treasurers and facility managers of gated estates in Ibadan and Lagos |
| Problem | Paper visitor books, WhatsApp payment proofs, spreadsheets and opaque spending |
| Top objections | Residents will not install an app; guards are not technical; money handling trust; privacy |
| Traffic | Direct and referral from estate committees; organic search for estate management software |
| Proof available | Product guarantees from the blueprint only. No customer logos, testimonials or statistics yet |
| Voice | Professional, calm, plain Nigerian English |
| Direction | Minimal editorial, light theme, EstateFlow brand colours |

## 1. Page outline

1. Floating navigation (How it works, Benefits, FAQ, Sign in, Book a pilot)
2. Hero: headline, subheadline, primary CTA, proof line, product visual
3. Problem to solution
4. Benefits (five)
5. Tagline reveal (word by word on scroll)
6. How it works (three steps)
7. Proof: built in safeguards (testimonials slot renders only once real quotes are supplied)
8. FAQ (ten questions, FAQ schema)
9. Risk reversal and final CTA with the pilot form
10. Footer with privacy and terms

## 2. Hero copy

- **Headline:** Every visitor verified. / Every naira accounted for.
- **Subheadline:** EstateFlow gives gated estates in Nigeria six digit visitor passes your guards check in seconds, dues invoices paid through Paystack with real receipts, and a ledger every resident can read.
- **CTA:** Book a pilot walkthrough
- **Proof line:** Works in any phone browser. Payments are confirmed with Paystack before a receipt is issued.

## 3. Benefits

- **Faster gate checks:** guards type a six digit code or scan a QR and see Allow entry or Do not allow, with the house number.
- **Payments you can trust:** an invoice is marked paid only after Paystack confirms the money, never from a screenshot.
- **A ledger residents can read:** Exco approves and publishes spending with evidence; published entries are never edited.
- **Help when it matters:** press and hold to alert security and managers, and see the moment someone acknowledges.
- **Maintenance with a paper trail:** photos, assignment, target response times and a timeline for every request.

## 4. How it works

1. We set up your estate: units, gates, roles, and your resident list imported from a spreadsheet.
2. Residents join from an invite link on any phone. No app store, no new hardware.
3. Guards verify at the gate, managers bill and record spending, Exco approves and publishes.

## 5. FAQ

See `src/config/marketing.ts` (`FAQ`). Rendered on the page and as `FAQPage` structured data.

## 6. SEO / AEO

Index. Evergreen offer with matching search intent.

- Title: `EstateFlow · Visitor passes and estate dues for Nigerian estates`
- Meta description: `EstateFlow gives gated estates in Nigeria verified visitor passes at the gate, service charge invoices with trustworthy receipts, and a ledger residents can read.`

## 7. Layout

**A. Classic hero plus sections.** The product is understood from a gate screen and a pass card,
and the audience is evaluating a known category (estate management). The argument is short enough
that a long form story is not needed.

## Open inputs (do not invent)

- Customer testimonials and logos: add to `TESTIMONIALS` in `src/config/marketing.ts`. Entries containing `{{` are never rendered.
- Pricing: agreed per estate during pilots; no price is shown until confirmed.
- Legal entity name and privacy contact for the privacy notice and terms (`{{legal_entity}}`, `{{privacy_contact_email}}`).
