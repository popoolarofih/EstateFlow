import { Phone } from "@phosphor-icons/react/dist/ssr";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card, CardHeader } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { ActiveContext } from "@/lib/auth/authorize";
import { profileDetails } from "@/server/repositories/profile";
import { EstateSwitcher } from "./estate-switcher";
import { PushOptIn } from "./push-opt-in";

/** Shared profile screen for every role. */
export async function ProfileView({ context }: { context: ActiveContext }) {
  const details = await profileDetails(context);
  const rows: [string, string][] = [
    ["Name", context.profile?.displayName ?? context.member.displayName],
    ["Email", context.user.email ?? "Not set"],
    ["Phone", context.user.phone ?? context.profile?.phone ?? "Not set"],
    ["Role", ROLE_LABELS[context.member.role]],
    ["Estate", context.estate.name],
  ];
  if (details.unitLabel) rows.push(["Unit", details.unitLabel]);
  return (
    <>
      <Card>
        <CardHeader title="Your account" />
        <dl className="grid gap-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap justify-between gap-2 border-b border-line pb-3">
              <dt className="caption-2 text-muted">{label}</dt>
              <dd className="body-5 text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {context.estate.emergencyContacts.length > 0 && (
        <Card>
          <CardHeader title="Estate emergency contacts" description="Call these if the app is unavailable." />
          <ul className="flex flex-col gap-2">
            {context.estate.emergencyContacts.map((contact) => (
              <li key={contact.phone}>
                <a href={`tel:${contact.phone}`} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line px-3 py-2 body-5 hover:bg-canvas">
                  <Phone size={20} aria-hidden /> {contact.label}: {contact.phone}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="flex flex-col gap-4">
        <CardHeader title="Settings" />
        <EstateSwitcher estates={details.estates} activeEstateId={context.estate.id} />
        <PushOptIn />
        <SignOutButton />
      </Card>
    </>
  );
}
