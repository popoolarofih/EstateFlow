"use client";

import { HardHat, Truck, User, UserCircle } from "@/components/ui/icons";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { List, ListRow } from "@/components/ui/list";
import { PassStatusBadge } from "@/components/ui/status-badges";
import { api, errorMessage } from "@/lib/api/client";
import { PASS_TYPE_LABELS, WEEKDAY_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";
import type { PassType, VisitorPass } from "@/types/domain";

const ICONS: Record<PassType, React.ReactNode> = {
  guest: <User size={20} />,
  delivery: <Truck size={20} />,
  contractor: <HardHat size={20} />,
  staff: <UserCircle size={20} />,
};

type PassRow = Pick<
  VisitorPass,
  "id" | "guestName" | "passType" | "status" | "validFrom" | "validUntil" | "recurrence" | "useCount" | "lastUsedAt"
>;

export function PassList({ passes, timezone, canRevoke }: { passes: PassRow[]; timezone: string; canRevoke: boolean }) {
  const router = useRouter();
  return (
    <List label="Visitor passes">
      {passes.map((pass) => (
        <ListRow
          key={pass.id}
          leading={ICONS[pass.passType]}
          title={pass.guestName}
          meta={
            <>
              {PASS_TYPE_LABELS[pass.passType]} ·{" "}
              {pass.recurrence
                ? `${pass.recurrence.daysOfWeek.map((day) => WEEKDAY_LABELS[day]).join(", ")} ${pass.recurrence.startTime} to ${pass.recurrence.endTime}, until ${formatDateTime(pass.validUntil, timezone)}`
                : `${formatDateTime(pass.validFrom, timezone)} to ${formatDateTime(pass.validUntil, timezone)}`}
              {pass.lastUsedAt && ` · last entry ${formatDateTime(pass.lastUsedAt, timezone)}`}
            </>
          }
          trailing={
            <>
              <PassStatusBadge status={pass.status} />
              {canRevoke && pass.status === "active" && (
                <ConfirmButton
                  label="Revoke"
                  title={`Revoke the pass for ${pass.guestName}?`}
                  description="The code and QR stop working at the gate immediately. This cannot be undone."
                  confirmLabel="Revoke pass"
                  danger
                  onConfirm={async () => {
                    try {
                      await api(`/api/passes/${pass.id}/revoke`, { method: "POST" });
                      router.refresh();
                    } catch (error) {
                      return errorMessage(error);
                    }
                  }}
                />
              )}
            </>
          }
        />
      ))}
    </List>
  );
}
