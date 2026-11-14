import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { LEGAL } from "@/config/marketing";

export const metadata: Metadata = { title: "Terms of use", description: "The terms for using EstateFlow." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="14 November 2026">
      <p>
        These terms govern use of EstateFlow, provided by {LEGAL.entity}. They must be reviewed by counsel before live
        deployment.
      </p>
      <h2>Accounts</h2>
      <p>
        Accounts are created by invitation from an estate. Keep your password private. Your estate manager can suspend
        access, which ends your sessions on every device.
      </p>
      <h2>Payments</h2>
      <p>
        Payments are processed by Paystack. An invoice is marked paid only after Paystack confirms the transaction. Questions
        about the amount of estate dues are for your estate management.
      </p>
      <h2>Emergency alerts</h2>
      <p>
        Emergency alerts notify your estate security and managers. EstateFlow does not guarantee a response and does not
        replace national emergency services. In an emergency, also call 112.
      </p>
      <h2>Acceptable use</h2>
      <p>Do not attempt to access another estate&apos;s data, guess pass codes, or interfere with the service.</p>
      <h2>Contact</h2>
      <p>Write to {LEGAL.privacyEmail}.</p>
    </LegalPage>
  );
}
