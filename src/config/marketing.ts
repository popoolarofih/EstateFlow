/**
 * Landing page content. Facts that have not been supplied by the EstateFlow team use clearly
 * marked placeholders and are never rendered (see `isPlaceholder`).
 */

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  estate: string;
}

/** Replace with real, consented quotes from pilot estates. Placeholder entries are hidden. */
export const TESTIMONIALS: Testimonial[] = [
  { quote: "{{testimonial}}", name: "{{name}}", role: "{{role}}", estate: "{{estate}}" },
];

export const LEGAL = {
  entity: "{{legal_entity}}",
  privacyEmail: "{{privacy_contact_email}}",
};

export function isPlaceholder(value: string): boolean {
  return value.includes("{{");
}

export const publishedTestimonials = () =>
  TESTIMONIALS.filter((item) => !Object.values(item).some((value) => isPlaceholder(value)));

export const FAQ: { question: string; answer: string }[] = [
  {
    question: "Do residents need to install an app?",
    answer:
      "No. EstateFlow runs in the browser on any smartphone. Residents open their invite link, create a password and can add EstateFlow to their home screen like an app.",
  },
  {
    question: "What happens at the gate if the internet goes down?",
    answer:
      "The guard screen shows a clear Connection lost message and tells the guard not to admit unverified codes and to call the supervisor. Verified offline QR passes are planned for a later release; the first release keeps online verification reliable and honest.",
  },
  {
    question: "Can someone guess a visitor code?",
    answer:
      "Codes are random, valid only at your estate and only inside the time window the resident set. They are stored as keyed hashes, revoked passes stop working instantly, and repeated wrong attempts are rate limited.",
  },
  {
    question: "How do dues payments reach the estate?",
    answer:
      "Residents pay on a Paystack hosted checkout. The estate settles to its own approved Paystack arrangement. EstateFlow never sees card details and marks an invoice paid only after Paystack confirms the transaction.",
  },
  {
    question: "Can guards see residents' phone numbers or balances?",
    answer:
      "No. The guard screen shows only what is needed at the gate: the decision, the unit and the visitor name. Financial information and resident contact details are not available to gate security.",
  },
  {
    question: "Can a published ledger entry be changed or deleted?",
    answer:
      "No. Once Exco publishes an entry it is permanent. Mistakes are corrected with a linked reversal that goes through the same approval, so residents can always see what changed and why.",
  },
  {
    question: "Who approves spending?",
    answer:
      "Facility managers record expenses with evidence. Exco members with approval rights approve and publish them. Above a threshold you set, two different approvers are required.",
  },
  {
    question: "Does the emergency button replace calling emergency services?",
    answer:
      "No. It alerts your estate security and managers immediately and shows the resident when someone acknowledges. If an alert cannot be sent, the app shows your estate's emergency numbers and the national emergency line.",
  },
  {
    question: "Who can see our estate's data?",
    answer:
      "Only active members of your estate, and only what their role allows. Every estate is isolated from every other estate, and sensitive actions are recorded in an audit log.",
  },
  {
    question: "How is pricing set?",
    answer:
      "We agree pricing with each estate during the pilot, based on the number of units. There is no hardware to buy and you can export your records as CSV at any time.",
  },
];
