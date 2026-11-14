import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberDialog } from "@/components/admin/member-dialog";
import { ContactsForm, EstateDetailsForm, GatesForm, OperationsForm, PaymentsForm } from "@/components/admin/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { requirePageContext } from "@/lib/auth/authorize";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { unitsDirectory } from "@/server/repositories";

export const metadata: Metadata = { title: "Settings" };

async function Settings() {
  const context = await requirePageContext("estate.settings");
  const { estate } = context;
  const { units, members } = await unitsDirectory(context);
  const unitOptions = units.map((unit) => ({ id: unit.id, label: unit.block ? `${unit.label}, ${unit.block}` : unit.label }));
  const unitLabels = new Map(unitOptions.map((unit) => [unit.id, unit.label]));
  const gateNames = new Map(estate.gates.map((gate) => [gate.id, gate.name]));
  return (
    <>
      <PageHeader title="Settings" description={`Configuration for ${estate.name}. Every change is recorded in the audit log.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Estate details" />
          <EstateDetailsForm estate={estate} />
        </Card>
        <Card>
          <CardHeader title="Gates" description="Guards are assigned to gates; passes can be limited to specific gates." />
          <GatesForm gates={estate.gates} />
        </Card>
        <Card>
          <CardHeader title="Emergency contacts" description="Shown to residents and guards when an alert cannot be sent." />
          <ContactsForm contacts={estate.emergencyContacts} />
        </Card>
        <Card>
          <CardHeader title="Operations" />
          <OperationsForm settings={estate.settings} />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Online payments" />
          <PaymentsForm config={estate.paymentConfig} />
        </Card>
      </div>
      <Card>
        <CardHeader title="Members and roles" description="Invite new members from Units and residents." />
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Assignment</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <Td>
                  <span className="title-4">{member.displayName}</span>
                  <span className="block caption-2 text-muted">{member.email}</span>
                </Td>
                <Td>{ROLE_LABELS[member.role]}</Td>
                <Td>
                  {member.role === "resident" && (member.unitId ? unitLabels.get(member.unitId) : "No unit")}
                  {member.role === "guard" && (member.gateIds.map((id) => gateNames.get(id) ?? id).join(", ") || "No gate")}
                  {member.role === "exco" && (member.permissions.length ? `${member.permissions.length} permissions` : "View only")}
                </Td>
                <Td>
                  <Badge tone={member.status === "active" ? "teal" : "alert"}>{member.status === "active" ? "Active" : "Suspended"}</Badge>
                </Td>
                <Td className="text-right">
                  <MemberDialog
                    member={{
                      id: member.id,
                      displayName: member.displayName,
                      role: member.role,
                      status: member.status,
                      gateIds: member.gateIds,
                      permissions: member.permissions,
                      unitId: member.unitId,
                    }}
                    units={unitOptions}
                    gates={estate.gates}
                    isSelf={member.uid === context.member.uid}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings />
    </Suspense>
  );
}
