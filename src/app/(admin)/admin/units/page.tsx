import { Buildings } from "@/components/ui/icons";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportPanel } from "@/components/admin/import-panel";
import { InviteDialog } from "@/components/admin/invite-dialog";
import { RevokeInviteButton } from "@/components/admin/revoke-invite-button";
import { UnitDialog } from "@/components/admin/unit-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { requirePageContext } from "@/lib/auth/authorize";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/time";
import { unitsDirectory } from "@/server/repositories";

export const metadata: Metadata = { title: "Units and residents" };

async function Units() {
  const context = await requirePageContext(["units.manage", "members.manage"]);
  const { units, members, invites } = await unitsDirectory(context);
  const membersByUid = new Map(members.map((member) => [member.uid, member]));
  const unitLabels = new Map(units.map((unit) => [unit.id, unit.label]));
  const tz = context.estate.timezone;
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Units and residents"
        description={`${units.length} units · ${members.filter((member) => member.role === "resident" && member.status === "active").length} active residents`}
        actions={
          <>
            <UnitDialog />
            <InviteDialog units={units.map((unit) => ({ id: unit.id, label: unit.block ? `${unit.label}, ${unit.block}` : unit.label }))} gates={context.estate.gates} />
          </>
        }
      />

      {units.length === 0 ? (
        <EmptyState icon={<Buildings size={24} />} title="Add your units" description="Add units one by one or import your resident list from a CSV file below." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Unit</Th>
              <Th>Block</Th>
              <Th>Occupancy</Th>
              <Th>Residents</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id}>
                <Td className="title-4">{unit.label}</Td>
                <Td>{unit.block ?? "None"}</Td>
                <Td>
                  <Badge tone={unit.occupancyStatus === "occupied" ? "teal" : "neutral"}>{unit.occupancyStatus === "occupied" ? "Occupied" : "Vacant"}</Badge>
                </Td>
                <Td>
                  {unit.residentUids.length === 0
                    ? "None yet"
                    : unit.residentUids.map((uid) => membersByUid.get(uid)?.displayName ?? "Resident").join(", ")}
                </Td>
                <Td className="text-right">
                  <UnitDialog unit={unit} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Card>
        <CardHeader title="Pending invitations" description="Invitation links expire after 14 days." />
        {invites.length === 0 ? (
          <p className="body-6 text-muted">No pending invitations.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Unit</Th>
                <Th>Expires</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <Td>
                    <span className="title-4">{invite.displayName}</span>
                    <span className="block caption-2 text-muted">{invite.email ?? invite.phone}</span>
                  </Td>
                  <Td>{ROLE_LABELS[invite.role]}</Td>
                  <Td>{invite.unitId ? (unitLabels.get(invite.unitId) ?? "Unknown") : "None"}</Td>
                  <Td>{invite.expiresAt < now ? <Badge tone="alert">Expired</Badge> : formatDate(invite.expiresAt, tz)}</Td>
                  <Td className="text-right">
                    <RevokeInviteButton inviteId={invite.id} name={invite.displayName} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Import residents from CSV" description="Columns: unit_label, block, floor, resident_name, resident_email, resident_phone. We check every row and detect duplicates before anything is saved." />
        <ImportPanel />
      </Card>
    </>
  );
}

export default function UnitsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Units />
    </Suspense>
  );
}
