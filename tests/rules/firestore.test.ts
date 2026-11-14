import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { getBytes, ref } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
const ESTATES = ["a", "b"] as const;
const ROLES = ["resident", "guard", "manager", "exco"] as const;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-estateflow",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const estate of ESTATES) {
      await setDoc(doc(db, "estates", estate), { name: `Estate ${estate}`, status: "active" });
      for (const role of ROLES) {
        await setDoc(doc(db, "estateMembers", `${estate}_${role}_${estate}`), {
          uid: `${estate}_${role}`,
          estateId: estate,
          role,
          status: "active",
          unitId: role === "resident" ? `${estate}_unit` : null,
          gateIds: role === "guard" ? ["main"] : [],
          permissions: [],
        });
      }
      await setDoc(doc(db, "estateMembers", `${estate}_former_${estate}`), { uid: `${estate}_former`, estateId: estate, role: "manager", status: "suspended", unitId: null, gateIds: [], permissions: [] });
      await setDoc(doc(db, "units", `${estate}_unit`), { estateId: estate, label: "14B", residentUids: [`${estate}_resident`] });
      await setDoc(doc(db, "visitorPasses", `${estate}_pass`), { estateId: estate, unitId: `${estate}_unit`, createdByUid: `${estate}_resident`, codeHash: "x", status: "active" });
      await setDoc(doc(db, "passCodes", `${estate}_lock`), { estateId: estate, passId: `${estate}_pass` });
      await setDoc(doc(db, "gateEvents", `${estate}_event_main`), { estateId: estate, gateId: "main" });
      await setDoc(doc(db, "gateEvents", `${estate}_event_back`), { estateId: estate, gateId: "back" });
      await setDoc(doc(db, "invoices", `${estate}_invoice`), { estateId: estate, unitId: `${estate}_unit`, status: "issued" });
      await setDoc(doc(db, "invoices", `${estate}_draft_invoice`), { estateId: estate, unitId: `${estate}_unit`, status: "draft" });
      await setDoc(doc(db, "payments", `${estate}_payment`), { estateId: estate, payerUid: `${estate}_resident` });
      await setDoc(doc(db, "ledgerEntries", `${estate}_published`), { estateId: estate, status: "published" });
      await setDoc(doc(db, "ledgerEntries", `${estate}_draft`), { estateId: estate, status: "draft" });
      await setDoc(doc(db, "emergencyAlerts", `${estate}_alert`), { estateId: estate, createdByUid: `${estate}_resident`, status: "open" });
      await setDoc(doc(db, "notifications", `${estate}_note`), { estateId: estate, uid: `${estate}_resident` });
      await setDoc(doc(db, "auditLogs", `${estate}_log`), { estateId: estate });
      await setDoc(doc(db, "invites", `${estate}_invite`), { estateId: estate, tokenHash: "x" });
    }
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe("tenant isolation", () => {
  it("lets members read their own estate and never another estate", async () => {
    for (const role of ROLES) {
      await assertSucceeds(getDoc(doc(as(`a_${role}`), "estates", "a")));
      await assertFails(getDoc(doc(as(`a_${role}`), "estates", "b")));
    }
    await assertFails(getDoc(doc(anon(), "estates", "a")));
  });

  it("isolates passes, invoices, ledger, alerts and audit logs across estates", async () => {
    const managerA = as("a_manager");
    for (const path of ["visitorPasses/b_pass", "invoices/b_invoice", "ledgerEntries/b_published", "emergencyAlerts/b_alert", "auditLogs/b_log", "units/b_unit", "gateEvents/b_event_main"]) {
      await assertFails(getDoc(doc(managerA, path)));
    }
  });

  it("treats suspended members as outsiders", async () => {
    await assertFails(getDoc(doc(as("a_former"), "estates", "a")));
    await assertFails(getDoc(doc(as("a_former"), "invoices", "a_invoice")));
  });
});

describe("role enforcement", () => {
  it("residents see their own unit's records only", async () => {
    const resident = as("a_resident");
    await assertSucceeds(getDoc(doc(resident, "visitorPasses", "a_pass")));
    await assertSucceeds(getDoc(doc(resident, "invoices", "a_invoice")));
    await assertFails(getDoc(doc(resident, "invoices", "a_draft_invoice")));
    await assertSucceeds(getDoc(doc(resident, "payments", "a_payment")));
    await assertSucceeds(getDoc(doc(resident, "emergencyAlerts", "a_alert")));
    await assertSucceeds(getDoc(doc(resident, "notifications", "a_note")));
    await assertFails(getDoc(doc(resident, "auditLogs", "a_log")));
  });

  it("residents read published ledger entries but not drafts", async () => {
    await assertSucceeds(getDoc(doc(as("a_resident"), "ledgerEntries", "a_published")));
    await assertFails(getDoc(doc(as("a_resident"), "ledgerEntries", "a_draft")));
    await assertSucceeds(getDoc(doc(as("a_exco"), "ledgerEntries", "a_draft")));
  });

  it("guards get gate and emergency data only, never finance", async () => {
    const guard = as("a_guard");
    await assertSucceeds(getDoc(doc(guard, "gateEvents", "a_event_main")));
    await assertFails(getDoc(doc(guard, "gateEvents", "a_event_back")));
    await assertSucceeds(getDocs(query(collection(guard, "emergencyAlerts"), where("estateId", "==", "a"), where("status", "in", ["open", "acknowledged"]))));
    for (const path of ["invoices/a_invoice", "payments/a_payment", "ledgerEntries/a_published", "visitorPasses/a_pass", "units/a_unit", "notifications/a_note"]) {
      await assertFails(getDoc(doc(guard, path)));
    }
  });

  it("memberships are readable by their owner and the estate's managers only", async () => {
    await assertSucceeds(getDoc(doc(as("a_resident"), "estateMembers", "a_resident_a")));
    await assertFails(getDoc(doc(as("a_resident"), "estateMembers", "a_guard_a")));
    await assertSucceeds(getDoc(doc(as("a_manager"), "estateMembers", "a_guard_a")));
    await assertFails(getDoc(doc(as("a_manager"), "estateMembers", "b_guard_b")));
  });

  it("keeps server only collections closed", async () => {
    for (const path of ["passCodes/a_lock", "invites/a_invite"]) {
      await assertFails(getDoc(doc(as("a_manager"), path)));
    }
  });
});

describe("no direct client writes", () => {
  it("rejects every client write, including role and payment tampering", async () => {
    const resident = as("a_resident");
    await assertFails(updateDoc(doc(resident, "estateMembers", "a_resident_a"), { role: "manager" }));
    await assertFails(setDoc(doc(resident, "estateMembers", "a_resident_b"), { uid: "a_resident", estateId: "b", role: "manager", status: "active" }));
    await assertFails(updateDoc(doc(resident, "invoices", "a_invoice"), { status: "paid" }));
    await assertFails(setDoc(doc(resident, "payments", "forged"), { estateId: "a", status: "verified" }));
    await assertFails(setDoc(doc(resident, "visitorPasses", "forged"), { estateId: "a", status: "active" }));
    await assertFails(updateDoc(doc(as("a_exco"), "ledgerEntries", "a_published"), { amountKobo: 1 }));
    await assertFails(deleteDoc(doc(as("a_manager"), "ledgerEntries", "a_published")));
    await assertFails(setDoc(doc(as("a_guard"), "gateEvents", "forged"), { estateId: "a", gateId: "main" }));
  });
});

describe("storage", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const storage = context.storage();
      const { uploadBytes } = await import("firebase/storage");
      await uploadBytes(ref(storage, "estates/a/ledger/entry1/receipt.pdf"), new Uint8Array([37, 80, 68, 70]));
    });
  });

  // firebase-tools routes the Storage emulator's cross-service Firestore lookups through
  // HTTPS_PROXY and ignores NO_PROXY (lib/apiv2.js), so behind a proxy `firestore.get()` in
  // storage rules always sees a missing document. Runs everywhere without a proxy (local, CI).
  const behindProxy = Boolean(process.env.HTTPS_PROXY || process.env.https_proxy);
  it.skipIf(behindProxy)("limits evidence to finance roles of the owning estate", async () => {
    await assertSucceeds(getBytes(ref(env.authenticatedContext("a_exco").storage(), "estates/a/ledger/entry1/receipt.pdf")));
    await assertFails(getBytes(ref(env.authenticatedContext("a_guard").storage(), "estates/a/ledger/entry1/receipt.pdf")));
    await assertFails(getBytes(ref(env.authenticatedContext("b_manager").storage(), "estates/a/ledger/entry1/receipt.pdf")));
  });
});
