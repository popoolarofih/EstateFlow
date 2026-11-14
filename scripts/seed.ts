/**
 * Seeds the Firebase Emulator Suite with two estates so tenant isolation can be exercised by
 * hand. Refuses to run against anything but the emulators.
 *
 *   npm run emulators:fresh      (terminal 1)
 *   npm run seed                 (terminal 2)
 *
 * Every account uses the password printed at the end.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { buildPostings } from "../src/lib/ledger/ledger";
import { periodKeyFor } from "../src/lib/billing/invoices";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Refusing to seed: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must point at the emulators.");
  process.exit(1);
}

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "demo-estateflow";
const PASSWORD = "EstateFlow!2026";
if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

const ESTATES = [
  {
    id: "akobo_gardens",
    name: "Akobo Gardens Estate",
    address: "Plot 12 Akobo Road, Akobo",
    city: "Ibadan",
    state: "Oyo",
    gates: [{ id: "main_gate", name: "Main gate" }, { id: "back_gate", name: "Back gate" }],
    units: [["14B", "Palm Close"], ["14C", "Palm Close"], ["3", "Iroko Avenue"], ["7", "Iroko Avenue"], ["21", "Mahogany Drive"]],
    people: {
      manager: "Folake Adeyemi",
      exco: "Babatunde Ogunleye",
      guard: "Musa Ibrahim",
      resident: "Adaeze Okafor",
    },
  },
  {
    id: "lekki_palms",
    name: "Lekki Palms Residence",
    address: "5 Admiralty Way, Lekki Phase 1",
    city: "Lagos",
    state: "Lagos",
    gates: [{ id: "main_gate", name: "Main gate" }],
    units: [["A1", "Block A"], ["A2", "Block A"], ["B4", "Block B"]],
    people: {
      manager: "Ngozi Eze",
      exco: "Kunle Bakare",
      guard: "Emeka Nwosu",
      resident: "Tolu Martins",
    },
  },
] as const;

async function user(email: string, displayName: string, claims?: Record<string, unknown>): Promise<string> {
  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    uid = (await auth.createUser({ email, password: PASSWORD, displayName, emailVerified: true })).uid;
  }
  if (claims) await auth.setCustomUserClaims(uid, claims);
  await db.collection("users").doc(uid).set(
    { displayName, email, phone: null, photoURL: null, disabled: false, activeEstateId: null, createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return uid;
}

async function main() {
  const accounts: string[][] = [];
  const adminUid = await user("platform@estateflow.test", "Platform Admin", { platformAdmin: true });
  accounts.push(["platform admin", "platform@estateflow.test"]);

  for (const estate of ESTATES) {
    await db.collection("estates").doc(estate.id).set({
      name: estate.name,
      slug: estate.id,
      address: estate.address,
      city: estate.city,
      state: estate.state,
      timezone: "Africa/Lagos",
      currency: "NGN",
      status: "active",
      planId: "pilot",
      gates: estate.gates,
      settings: { maxActivePassesPerUnit: 30, ticketReopenDays: 7, expenseDualApprovalThresholdKobo: 50_000_000, invoiceDueDays: 14, autoGenerateInvoices: false },
      paymentConfig: { enabled: true, provider: "paystack", subaccountCode: null, transactionChargeKobo: null },
      emergencyContacts: [{ label: "Security supervisor", phone: "+2348031234501" }],
      createdAt: FieldValue.serverTimestamp(),
      createdBy: adminUid,
    });
    await db.collection("estateSlugs").doc(estate.id).set({ estateId: estate.id });

    const unitIds: string[] = [];
    for (const [label, block] of estate.units) {
      const id = `${estate.id}_${label.toLowerCase()}`;
      unitIds.push(id);
      await db.collection("units").doc(id).set({
        estateId: estate.id, label, block, floor: null, occupancyStatus: "vacant", residentUids: [], billingProfileId: null, createdAt: FieldValue.serverTimestamp(),
      });
    }

    const uids: Record<string, string> = {};
    for (const role of ["manager", "exco", "guard", "resident"] as const) {
      const email = `${role}@${estate.id}.test`;
      const name = estate.people[role];
      const uid = await user(email, name);
      uids[role] = uid;
      accounts.push([`${estate.name} ${role}`, email]);
      await db.collection("estateMembers").doc(`${uid}_${estate.id}`).set({
        uid, estateId: estate.id, role, status: "active", displayName: name, email,
        unitId: role === "resident" ? unitIds[0] : null,
        gateIds: role === "guard" ? estate.gates.map((gate) => gate.id) : [],
        permissions: role === "exco" ? ["ledger.approve", "ledger.publish", "billingRule.approve"] : [],
        joinedAt: FieldValue.serverTimestamp(),
      });
      await db.collection("users").doc(uid).set({ activeEstateId: estate.id }, { merge: true });
    }
    await db.collection("units").doc(unitIds[0]!).update({ residentUids: [uids.resident], occupancyStatus: "occupied" });
    for (const id of unitIds.slice(1, 3)) await db.collection("units").doc(id).update({ occupancyStatus: "occupied" });

    // An approved monthly service charge and a published expense with no evidence file.
    await db.collection("billingRules").doc(`${estate.id}_service_charge`).set({
      estateId: estate.id, name: "Service charge", description: "Security, cleaning and common area power",
      frequency: "monthly", amountKobo: estate.id === "lekki_palms" ? 4_750_000 : 2_250_000,
      status: "approved", createdBy: uids.manager, createdAt: FieldValue.serverTimestamp(), approvedBy: uids.exco, approvedAt: FieldValue.serverTimestamp(),
    });
    const amountKobo = estate.id === "lekki_palms" ? 38_640_000 : 18_725_000;
    await db.collection("ledgerEntries").doc(`${estate.id}_diesel`).set({
      estateId: estate.id, type: "expense", kind: "original", category: "Generator and diesel", vendor: "Ascon Energy",
      description: `Diesel supply for ${periodKeyFor(new Date(), "monthly", "Africa/Lagos")}`, amountKobo, transactionDate: new Date(),
      status: "published", postings: buildPostings({ type: "expense", category: "Generator and diesel", amountKobo, source: "manual" }),
      evidencePaths: [], source: "manual", paymentId: null, reversesEntryId: null,
      approvals: [{ uid: uids.exco, name: estate.people.exco, at: new Date() }], requiredApprovals: 1,
      createdBy: uids.manager, createdByName: estate.people.manager, approvedBy: uids.exco,
      publishedAt: FieldValue.serverTimestamp(), publishedBy: uids.exco, createdAt: FieldValue.serverTimestamp(),
    });
  }

  console.log("\nSeeded two estates. Password for every account:", PASSWORD);
  console.table(accounts.map(([who, email]) => ({ who, email })));
  console.log("Generate invoices from Admin > Billing, then create passes as a resident and verify them as the guard.");
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
