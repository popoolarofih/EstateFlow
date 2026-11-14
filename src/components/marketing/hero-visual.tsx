import { CheckCircle, QrCode, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

/** Product illustration built from the real UI language: guard decision and resident pass card. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="rounded-3xl border border-line bg-navy p-4 shadow-xl">
        <div className="flex items-center justify-between px-2 pb-4">
          <span className="caption-1 text-white/60">Main gate</span>
          <span className="caption-1 text-white/60">10:42</span>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-teal px-6 py-8 text-center text-navy">
          <CheckCircle size={56} weight="fill" />
          <p className="heading-5 uppercase tracking-wide">Allow entry</p>
          <p className="title-2">Unit 14B</p>
          <p className="body-5">Chinedu Eze · Guest</p>
          <p className="caption-4">Pass valid until 6:30 pm</p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6"].map((digit) => (
            <span key={digit} className="flex h-12 items-center justify-center rounded-xl bg-white/10 font-mono title-2 text-white">
              {digit}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-8 -left-4 w-56 rounded-2xl border border-line bg-surface p-4 shadow-lg sm:-left-12">
        <div className="flex items-center gap-2">
          <QrCode size={20} className="text-violet" />
          <p className="caption-3 text-muted">Pass shared on WhatsApp</p>
        </div>
        <p className="mt-2 font-mono heading-5 tracking-widest text-navy">482 913</p>
        <p className="caption-5 text-muted">Today, 9:00 am to 6:30 pm</p>
      </div>
      <div className="absolute -right-2 -top-6 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-md sm:-right-8">
        <ShieldCheck size={20} className="text-teal-ink" />
        <p className="caption-3 text-ink">Paystack confirmed</p>
      </div>
    </div>
  );
}
