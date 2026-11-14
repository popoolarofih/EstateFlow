import {
  ArrowRight,
  Bell,
  Buildings,
  ClipboardText,
  CurrencyNgn,
  DeviceMobile,
  Fingerprint,
  Gavel,
  LockKey,
  Notebook,
  Scroll,
  ShieldCheck,
  Siren,
  UsersThree,
  Wrench,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { PilotForm } from "@/components/marketing/pilot-form";
import { Reveal } from "@/components/marketing/reveal";
import { SiteNav } from "@/components/marketing/site-nav";
import { TaglineReveal } from "@/components/marketing/tagline-reveal";
import { SiteFooter } from "@/components/marketing/site-footer";
import { buttonClasses } from "@/components/ui/button";
import { FAQ, publishedTestimonials } from "@/config/marketing";

export const metadata: Metadata = {
  title: { absolute: "EstateFlow · Visitor passes and estate dues for Nigerian estates" },
  alternates: { canonical: "/" },
};

const PROBLEMS = [
  {
    before: "Guards copy names into a visitor book and call houses to confirm.",
    after: "Residents send a six digit pass before the guest arrives. The guard checks it in seconds.",
  },
  {
    before: "Dues are paid by transfer and proven with screenshots on WhatsApp.",
    after: "Residents pay through Paystack. The invoice updates only when Paystack confirms the money.",
  },
  {
    before: "Residents hear about spending at the AGM, if at all.",
    after: "Exco publishes approved spending with receipts in a ledger every resident can read.",
  },
];

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "Faster gate checks",
    body: "Guards type a six digit code or scan a QR and see Allow entry or Do not allow, with the house number. Every attempt is logged.",
  },
  {
    icon: CurrencyNgn,
    title: "Payments you can trust",
    body: "An invoice is marked paid only after Paystack confirms the transaction, never from a screenshot. Residents download their receipt.",
  },
  {
    icon: Notebook,
    title: "A ledger residents can read",
    body: "Managers record spending with evidence, Exco approves and publishes. Published entries are never edited; corrections are visible reversals.",
  },
  {
    icon: Siren,
    title: "Help when it matters",
    body: "Residents press and hold to alert security and managers, then see the moment someone acknowledges. Unanswered alerts escalate.",
  },
  {
    icon: Wrench,
    title: "Maintenance with a paper trail",
    body: "Requests arrive with photos, get assigned with a target response time, and keep a full timeline until the resident confirms the fix.",
  },
];

const STEPS = [
  {
    icon: Buildings,
    title: "We set up your estate",
    body: "Units, gates and roles, with your resident list imported from a spreadsheet. Duplicates are caught before anything is saved.",
  },
  {
    icon: DeviceMobile,
    title: "Residents join from a link",
    body: "Each resident gets a one time invite link and signs up in the browser on any phone. No app store, no new hardware.",
  },
  {
    icon: UsersThree,
    title: "Everyone works from one record",
    body: "Guards verify at the gate, managers bill and record spending, Exco approves and publishes. Everyone sees what their role allows.",
  },
];

const SAFEGUARDS = [
  { icon: LockKey, title: "Estate isolation", body: "Members see only their own estate, and only what their role permits, checked on the server for every request." },
  { icon: Fingerprint, title: "Codes stored as keyed hashes", body: "Pass codes are never stored in plain text, are bound to your estate, and stop working the moment they are revoked." },
  { icon: Gavel, title: "Provider verified payments", body: "Webhook signatures are checked and amounts are confirmed with Paystack before an invoice, receipt or ledger changes." },
  { icon: Scroll, title: "Audit trail", body: "Role changes, invoices, payments, pass revocations, emergencies and ledger approvals are all recorded with who and when." },
  { icon: Bell, title: "No exposure at the gate", body: "Guards never see resident phone numbers, balances or payment records. They see the decision and the unit." },
  { icon: ClipboardText, title: "Your data, exportable", body: "Invoices, collections, expenses and gate events export to CSV at any time for your accountant or AGM." },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function LandingPage() {
  const testimonials = publishedTestimonials();
  return (
    <div className="bg-surface">
      <SiteNav />
      <main id="main">
        {/* Hero */}
        <section className="overflow-hidden bg-canvas px-4 pb-24 pt-32 md:pb-32 md:pt-40">
          <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1fr_440px]">
            <div className="flex flex-col gap-6">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 caption-1 text-muted">
                <span aria-hidden className="size-2 rounded-full bg-teal" /> Estate operations for Nigeria
              </p>
              <h1 className="max-w-[680px] heading-3 hero-gradient-text md:heading-2 xl:heading-1">
                Every visitor verified.
                <br />
                Every naira accounted for.
              </h1>
              <p className="max-w-[680px] body-3 text-muted md:title-1 md:font-normal">
                EstateFlow gives gated estates six digit visitor passes your guards check in seconds, dues invoices paid through
                Paystack with real receipts, and a ledger every resident can read.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="#pilot" className={buttonClasses("dark", "lg")}>
                  <span>Book a pilot walkthrough</span>
                  <ArrowRight size={20} aria-hidden />
                </Link>
              </div>
              <p className="flex items-start gap-2 caption-2 text-muted">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-teal-ink" aria-hidden />
                <span>Works in any phone browser. Payments are confirmed with Paystack before a receipt is issued.</span>
              </p>
            </div>
            <div className="px-4 pb-8 sm:px-12">
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* Problem to solution */}
        <section aria-labelledby="problem-title" className="px-4 py-24 md:py-32">
          <div className="mx-auto flex max-w-6xl flex-col gap-12">
            <Reveal className="flex max-w-[680px] flex-col gap-4">
              <h2 id="problem-title" className="heading-4 text-ink md:heading-3">
                Visitor books and WhatsApp proofs leave gaps nobody can audit
              </h2>
              <p className="body-3 text-muted">EstateFlow replaces three fragile habits with one record your whole estate can trust.</p>
            </Reveal>
            <div className="grid gap-6 md:grid-cols-3">
              {PROBLEMS.map((item, index) => (
                <Reveal key={item.before} delay={index * 80}>
                  <article className="flex h-full flex-col gap-4 rounded-3xl border border-line bg-canvas p-6">
                    <p className="body-6 text-muted">
                      <span className="caption-3 text-alert-ink">Today </span>
                      {item.before}
                    </p>
                    <p className="body-2 text-ink">
                      <span className="caption-3 text-teal-ink">With EstateFlow </span>
                      {item.after}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" aria-labelledby="benefits-title" className="scroll-mt-24 bg-canvas px-4 py-24 md:py-32">
          <div className="mx-auto flex max-w-6xl flex-col gap-12">
            <Reveal className="flex max-w-[680px] flex-col gap-4">
              <h2 id="benefits-title" className="heading-4 text-ink md:heading-3">
                Built for the gate, the treasurer and the resident
              </h2>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <Reveal key={benefit.title} delay={index * 60}>
                    <article className="flex h-full flex-col gap-4 rounded-3xl border border-line bg-surface p-6 transition duration-300 ease-weighted hover:-translate-y-1">
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-navy text-teal" aria-hidden>
                        <Icon size={24} />
                      </span>
                      <h3 className="heading-6 text-ink">{benefit.title}</h3>
                      <p className="body-6 text-muted">{benefit.body}</p>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tagline reveal */}
        <section aria-label="Why EstateFlow" className="px-4 py-24 md:py-40">
          <div className="mx-auto max-w-6xl">
            <TaglineReveal
              lines={[
                "Your estate runs on trust.",
                "EstateFlow puts every gate entry,",
                "every payment and every naira spent",
                "on the record.",
              ]}
            />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24 bg-navy px-4 py-24 text-white md:py-32">
          <div className="mx-auto flex max-w-6xl flex-col gap-12">
            <Reveal className="flex max-w-[680px] flex-col gap-4">
              <h2 id="how-title" className="heading-4 md:heading-3">
                Live in three steps
              </h2>
              <p className="body-3 text-white/70">A pilot runs on the phones your residents and guards already carry.</p>
            </Reveal>
            <ol className="grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.title}>
                    <Reveal delay={index * 80} className="h-full">
                    <div className="flex h-full flex-col gap-4 rounded-3xl border border-white/10 bg-navy-soft p-6">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-teal font-mono title-3 text-navy">{index + 1}</span>
                        <Icon size={24} className="text-white/70" aria-hidden />
                      </div>
                      <h3 className="heading-6">{step.title}</h3>
                      <p className="body-6 text-white/70">{step.body}</p>
                    </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Proof */}
        <section aria-labelledby="proof-title" className="px-4 py-24 md:py-32">
          <div className="mx-auto flex max-w-6xl flex-col gap-12">
            <Reveal className="flex max-w-[680px] flex-col gap-4">
              <h2 id="proof-title" className="heading-4 text-ink md:heading-3">
                Safeguards your Exco can explain at the AGM
              </h2>
              <p className="body-3 text-muted">These are built into the product, not settings someone has to remember.</p>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SAFEGUARDS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.title} delay={index * 60}>
                    <article className="flex h-full gap-4 rounded-3xl border border-line p-6">
                      <Icon size={24} className="shrink-0 text-violet" aria-hidden />
                      <div className="flex flex-col gap-2">
                        <h3 className="title-2 text-ink">{item.title}</h3>
                        <p className="body-6 text-muted">{item.body}</p>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </div>
            {testimonials.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {testimonials.map((item) => (
                  <figure key={item.name} className="flex flex-col gap-4 rounded-3xl bg-canvas p-6">
                    <blockquote className="title-1 text-ink">“{item.quote}”</blockquote>
                    <figcaption className="caption-1 text-muted">
                      {item.name}, {item.role}, {item.estate}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 bg-canvas px-4 py-24 md:py-32">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_2fr]">
            <Reveal className="flex flex-col gap-4">
              <h2 id="faq-title" className="heading-4 text-ink md:heading-3">
                Questions estates ask us
              </h2>
              <p className="body-3 text-muted">Something else on your mind? Ask in the pilot form below.</p>
            </Reveal>
            <div className="flex flex-col gap-3">
              {FAQ.map((item) => (
                <details key={item.question} className="group rounded-2xl border border-line bg-surface p-6 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 title-2 text-ink [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span aria-hidden className="text-muted transition duration-300 ease-weighted group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 body-6 text-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Risk reversal and final CTA */}
        <section id="pilot" aria-labelledby="pilot-title" className="scroll-mt-24 px-4 py-24 md:py-32">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
            <Reveal className="flex flex-col gap-6">
              <h2 id="pilot-title" className="heading-4 text-ink md:heading-3">
                Start with a pilot, not a contract
              </h2>
              <p className="body-3 text-muted">
                We set up your estate, import your residents and train your guards and managers. You see your own gate and
                collections working before you commit.
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  "No app installs for residents or guards",
                  "No hardware to buy; any smartphone or tablet works",
                  "Export your records as CSV whenever you want",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 body-5 text-ink">
                    <ShieldCheck size={20} className="text-teal-ink" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={80}>
              <div className="rounded-3xl border border-line bg-canvas p-6 md:p-8">
                <PilotForm />
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
    </div>
  );
}
