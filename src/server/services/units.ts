import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { z } from "zod";
import { assertSameEstate } from "@/lib/auth/authorize";
import { can } from "@/lib/auth/permissions";
import { auditInTransaction, audit } from "@/lib/audit/audit";
import { conflict, forbidden } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { fromDoc, fromQuery } from "@/lib/firestore/convert";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { planResidentImport, unitKey, type ImportPlan } from "@/lib/imports/residents";
import type { importSchema, unitSchema } from "@/lib/validation/members";
import type { EstateMember, Invite, Unit } from "@/types/domain";
import type { ServiceContext } from "./context";
import { writeInvite, type CreatedInvite } from "./members";

async function loadUnits(estateId: string): Promise<Unit[]> {
  const snapshot = await adminDb().collection(COLLECTIONS.units).where("estateId", "==", estateId).limit(5000).get();
  return fromQuery<Unit>(snapshot);
}

export async function createUnit(
  { context, actor }: ServiceContext,
  input: z.output<typeof unitSchema>,
): Promise<{ id: string }> {
  if (!can(context.member, "units.manage")) throw forbidden();
  const db = adminDb();
  const units = await loadUnits(context.estate.id);
  const key = unitKey(input.label, input.block);
  if (units.some((unit) => unitKey(unit.label, unit.block) === key)) throw conflict("A unit with this label already exists.");
  const ref = db.collection(COLLECTIONS.units).doc();
  const batch = db.batch();
  batch.create(ref, {
    estateId: context.estate.id,
    label: input.label,
    block: input.block || null,
    floor: input.floor || null,
    occupancyStatus: input.occupancyStatus,
    residentUids: [],
    billingProfileId: null,
    createdAt: FieldValue.serverTimestamp(),
  } satisfies Omit<Unit, "id" | "createdAt"> & { createdAt: FieldValue });
  auditInTransaction(db, batch, actor, {
    estateId: context.estate.id,
    action: "unit.created",
    entityType: "unit",
    entityId: ref.id,
    after: { label: input.label, block: input.block },
  });
  await batch.commit();
  return { id: ref.id };
}

export async function updateUnit(
  { context, actor }: ServiceContext,
  unitId: string,
  input: z.output<typeof unitSchema>,
): Promise<void> {
  if (!can(context.member, "units.manage")) throw forbidden();
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.units).doc(unitId);
  const before = assertSameEstate(fromDoc<Unit>(await ref.get()), context);
  const key = unitKey(input.label, input.block);
  const clash = (await loadUnits(context.estate.id)).some(
    (unit) => unit.id !== unitId && unitKey(unit.label, unit.block) === key,
  );
  if (clash) throw conflict("Another unit already uses this label.");
  if (input.occupancyStatus === "vacant" && before.residentUids.length > 0) {
    throw conflict("Move or suspend the residents of this unit before marking it vacant.");
  }
  const after = { label: input.label, block: input.block || null, floor: input.floor || null, occupancyStatus: input.occupancyStatus };
  const batch = db.batch();
  batch.update(ref, after);
  auditInTransaction(db, batch, actor, {
    estateId: before.estateId,
    action: "unit.updated",
    entityType: "unit",
    entityId: unitId,
    before: { label: before.label, block: before.block, floor: before.floor, occupancyStatus: before.occupancyStatus },
    after,
  });
  await batch.commit();
}

export interface ImportOutcome {
  plan: ImportPlan;
  committed: boolean;
  importId: string | null;
  invites: CreatedInvite[];
}

/**
 * Previews or commits a resident CSV. A commit always re-plans on the server; the browser's
 * preview is never trusted.
 */
export async function importResidents(
  { context, actor }: ServiceContext,
  input: z.output<typeof importSchema>,
): Promise<ImportOutcome> {
  if (!can(context.member, "residents.import")) throw forbidden();
  const db = adminDb();
  const estateId = context.estate.id;
  const [units, members, invites] = await Promise.all([
    loadUnits(estateId),
    db.collection(COLLECTIONS.estateMembers).where("estateId", "==", estateId).limit(5000).get(),
    db.collection(COLLECTIONS.invites).where("estateId", "==", estateId).where("status", "==", "pending").limit(5000).get(),
  ]);
  const knownEmails = new Set<string>();
  const knownPhones = new Set<string>();
  for (const member of fromQuery<EstateMember>(members)) if (member.email) knownEmails.add(member.email);
  for (const invite of fromQuery<Invite>(invites)) {
    if (invite.email) knownEmails.add(invite.email);
    if (invite.phone) knownPhones.add(invite.phone);
  }
  const plan = planResidentImport(input.csv, {
    unitsByKey: new Map(units.map((unit) => [unitKey(unit.label, unit.block), unit.id])),
    knownEmails,
    knownPhones,
  });
  if (input.mode === "preview") return { plan, committed: false, importId: null, invites: [] };
  if (plan.rows.length === 0) return { plan, committed: false, importId: null, invites: [] };

  const unitIds = new Map<string, string>(units.map((unit) => [unitKey(unit.label, unit.block), unit.id]));
  const created: CreatedInvite[] = [];
  const rows = plan.rows.filter((row) => row.errors.length === 0);

  for (let i = 0; i < rows.length; i += 150) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + 150)) {
      let unitId = unitIds.get(row.unitKey);
      if (!unitId) {
        const ref = db.collection(COLLECTIONS.units).doc();
        unitId = ref.id;
        unitIds.set(row.unitKey, unitId);
        batch.create(ref, {
          estateId,
          label: row.unitLabel,
          block: row.block,
          floor: row.floor,
          occupancyStatus: "vacant",
          residentUids: [],
          billingProfileId: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      if (row.residentAction === "invite" && row.residentName) {
        created.push(
          writeInvite(
            db,
            batch,
            estateId,
            {
              displayName: row.residentName,
              email: row.residentEmail,
              phone: row.residentPhone,
              role: "resident",
              unitId,
              gateIds: [],
            },
            actor,
          ),
        );
      }
    }
    await batch.commit();
  }

  const report = await db.collection(COLLECTIONS.imports).add({
    estateId,
    createdBy: context.member.uid,
    createdAt: FieldValue.serverTimestamp(),
    summary: plan.summary,
    rows: plan.rows.slice(0, 500).map((row) => ({
      rowNumber: row.rowNumber,
      unitLabel: row.unitLabel,
      unitAction: row.unitAction,
      residentAction: row.residentAction,
      errors: row.errors,
    })),
  });
  await audit(db, actor, {
    estateId,
    action: "residents.imported",
    entityType: "import",
    entityId: report.id,
    after: { ...plan.summary },
  });
  return { plan, committed: true, importId: report.id, invites: created };
}
