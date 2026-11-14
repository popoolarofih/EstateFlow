import { FieldValue } from "firebase-admin/firestore";
import type { ActiveContext } from "@/lib/auth/authorize";
import type { AuditActor } from "@/lib/audit/audit";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, memberDocId } from "@/lib/firestore/paths";
import { DEFAULT_SETTINGS } from "@/server/services/estates";
import type { Estate, EstateMember, Role, Unit } from "@/types/domain";

export async function clearFirestore(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const project = process.env.FIREBASE_PROJECT_ID;
  const response = await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Could not clear the Firestore emulator: ${response.status}`);
}

export function estateDoc(id: string, overrides: Partial<Estate> = {}): Estate {
  return {
    id,
    name: `Estate ${id}`,
    slug: id,
    address: "1 Test Road",
    city: "Ibadan",
    state: "Oyo",
    timezone: "Africa/Lagos",
    currency: "NGN",
    status: "active",
    planId: "pilot",
    gates: [
      { id: "main", name: "Main gate" },
      { id: "back", name: "Back gate" },
    ],
    settings: DEFAULT_SETTINGS,
    paymentConfig: { enabled: true, provider: "paystack", subaccountCode: null, transactionChargeKobo: null },
    emergencyContacts: [],
    createdAt: new Date(),
    createdBy: "platform",
    ...overrides,
  };
}

export interface SeededEstate {
  estate: Estate;
  unit: Unit;
  members: Record<Role, EstateMember>;
}

/** Seeds an estate with one occupied unit and one member per role. */
export async function seedEstate(id: string, options: { excoPermissions?: EstateMember["permissions"] } = {}): Promise<SeededEstate> {
  const db = adminDb();
  const estate = estateDoc(id);
  const { id: estateId, ...estateData } = estate;
  await db.collection(COLLECTIONS.estates).doc(estateId).set(estateData);
  const unit: Unit = {
    id: `${id}_unit1`,
    estateId: id,
    label: "14B",
    block: "Palm Close",
    floor: null,
    occupancyStatus: "occupied",
    residentUids: [`${id}_resident`],
    billingProfileId: null,
    createdAt: new Date(),
  };
  const { id: unitId, ...unitData } = unit;
  await db.collection(COLLECTIONS.units).doc(unitId).set(unitData);

  const roles: Role[] = ["resident", "guard", "manager", "exco"];
  const members = {} as Record<Role, EstateMember>;
  for (const role of roles) {
    const uid = `${id}_${role}`;
    const member: EstateMember = {
      id: memberDocId(uid, id),
      uid,
      estateId: id,
      role,
      unitId: role === "resident" ? unit.id : null,
      gateIds: role === "guard" ? ["main"] : [],
      status: "active",
      permissions: role === "exco" ? (options.excoPermissions ?? ["ledger.approve", "ledger.publish", "billingRule.approve"]) : [],
      displayName: `${role} of ${id}`,
      email: `${role}@${id}.test`,
      joinedAt: new Date(),
    };
    const { id: memberId, ...memberData } = member;
    await db.collection(COLLECTIONS.estateMembers).doc(memberId).set(memberData);
    await db.collection(COLLECTIONS.users).doc(uid).set({ displayName: member.displayName, email: member.email, phone: null, createdAt: FieldValue.serverTimestamp() });
    members[role] = member;
  }
  return { estate, unit, members };
}

export function contextFor(seed: SeededEstate, role: Role, overrides: Partial<EstateMember> = {}): { context: ActiveContext; actor: AuditActor } {
  const member = { ...seed.members[role], ...overrides };
  return {
    context: {
      user: { uid: member.uid, email: member.email, phone: null, emailVerified: true, platformAdmin: false },
      profile: {
        id: member.uid,
        displayName: member.displayName,
        email: member.email,
        phone: null,
        photoURL: null,
        activeEstateId: seed.estate.id,
        createdAt: new Date(),
        disabled: false,
      },
      member,
      estate: seed.estate,
      memberships: [member],
    },
    actor: { uid: member.uid, name: member.displayName },
  };
}

export async function count(collection: string, field: string, value: unknown): Promise<number> {
  const snapshot = await adminDb().collection(collection).where(field, "==", value).count().get();
  return snapshot.data().count;
}
