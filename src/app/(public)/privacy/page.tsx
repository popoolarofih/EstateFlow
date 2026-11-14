import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL } from "@/config/marketing";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How EstateFlow collects, uses and protects personal data for estates, residents and gate staff.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="14 November 2026">
      <p>
        This notice explains how {LEGAL.entity} (EstateFlow) processes personal data when estates, residents, gate staff
        and managers use EstateFlow. It is written to meet the Nigeria Data Protection Act 2023. A full legal review must be
        completed before live deployment.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email address, phone number and the estate, unit and role you belong to.</li>
        <li>Visitor passes: the visitor name, an optional phone number used only for sharing, and validity times.</li>
        <li>Gate events: entries, exits and denied attempts, with the guard and gate involved.</li>
        <li>Billing: invoices, payment references and amounts. Card details are handled by Paystack and never reach EstateFlow.</li>
        <li>Maintenance requests and emergency alerts, including any photos you attach.</li>
      </ul>
      <h2>Why we use it</h2>
      <p>
        To provide estate operations your estate has contracted for: verifying visitors, issuing invoices and receipts,
        publishing the estate ledger, handling maintenance and coordinating emergency responses.
      </p>
      <h2>Who can see it</h2>
      <p>
        Only active members of your estate, limited by role. Gate security cannot see resident phone numbers, balances or
        payment records. Data from one estate is never visible to another estate.
      </p>
      <h2>Cookies</h2>
      <p>
        EstateFlow uses one strictly necessary, secure cookie to keep you signed in. We do not use advertising or analytics
        cookies, so no consent banner is shown.
      </p>
      <h2>Retention</h2>
      <p>
        Records are kept for as long as your estate uses EstateFlow and as required for financial record keeping. Your
        estate can export its records at any time.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask to access, correct or delete your personal data, or object to its processing. Contact your estate
        manager or write to {LEGAL.privacyEmail}.
      </p>
    </LegalPage>
  );
}
