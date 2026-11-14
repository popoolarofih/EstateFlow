import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { createQrToken } from "@/lib/passes/codes";
import { encodeQrPayload } from "@/lib/passes/qr";
import { expirePasses } from "@/server/jobs/operations";
import { createVisitorPass, recordVisitorExit, revokeVisitorPass, verifyVisitorPass } from "@/server/services/passes";
import { clearFirestore, contextFor, count, seedEstate, type SeededEstate } from "./fixtures";

let a: SeededEstate;
let b: SeededEstate;

function window(minutesFromNow: number, durationMinutes: number) {
  const start = new Date(Date.now() + minutesFromNow * 60_000);
  return { validFrom: start.toISOString(), validUntil: new Date(start.getTime() + durationMinutes * 60_000).toISOString() };
}

async function guestPass(seed: SeededEstate, extra: Record<string, unknown> = {}) {
  return createVisitorPass(contextFor(seed, "resident"), {
    guestName: "Chinedu Eze",
    guestPhone: null,
    passType: "guest",
    ...window(0, 120),
    recurrence: null,
    allowedGateIds: [],
    ...extra,
  } as never);
}

beforeEach(async () => {
  await clearFirestore();
  a = await seedEstate("estate_a");
  b = await seedEstate("estate_b");
});

describe("visitor pass issuance and gate verification", () => {
  it("allows a valid code once, then reports it as used, logging every attempt", async () => {
    const issued = await guestPass(a);
    expect(issued.code).toMatch(/^\d{6}$/);
    const stored = (await adminDb().collection(COLLECTIONS.visitorPasses).doc(issued.passId).get()).data()!;
    expect(JSON.stringify(stored)).not.toContain(issued.code);

    const guard = contextFor(a, "guard");
    const first = await verifyVisitorPass(guard, { method: "code", code: issued.code, gateId: "main" });
    expect(first).toMatchObject({ allow: true, reason: "valid", unitLabel: "14B", guestName: "Chinedu Eze" });

    const second = await verifyVisitorPass(guard, { method: "code", code: issued.code, gateId: "main" });
    expect(second).toMatchObject({ allow: false, reason: "already_used" });
    expect(second.priorUseAt).toBeInstanceOf(Date);

    expect(await count(COLLECTIONS.gateEvents, "passId", issued.passId)).toBe(2);
    const pass = (await adminDb().collection(COLLECTIONS.visitorPasses).doc(issued.passId).get()).data()!;
    expect(pass).toMatchObject({ status: "used", useCount: 1 });
  });

  it("does not recognise a code from another estate (tenant isolation)", async () => {
    const issued = await guestPass(a);
    const result = await verifyVisitorPass(contextFor(b, "guard"), { method: "code", code: issued.code, gateId: "main" });
    expect(result).toMatchObject({ allow: false, reason: "not_recognised", unitLabel: null, guestName: null });
    // The attempt is still logged, against estate B only.
    expect(await count(COLLECTIONS.gateEvents, "estateId", "estate_b")).toBe(1);
  });

  it("rejects revoked passes and stale QR tokens", async () => {
    const issued = await guestPass(a);
    const guard = contextFor(a, "guard");
    const forged = encodeQrPayload({ ...JSON.parse(issued.qrPayload), token: createQrToken() });
    expect((await verifyVisitorPass(guard, { method: "qr", qr: forged, gateId: "main" })).reason).toBe("not_recognised");

    await revokeVisitorPass(contextFor(a, "resident"), issued.passId);
    expect((await verifyVisitorPass(guard, { method: "qr", qr: issued.qrPayload, gateId: "main" })).reason).toBe("revoked");
    // The code lock is released, so the code no longer resolves to the pass.
    expect((await verifyVisitorPass(guard, { method: "code", code: issued.code, gateId: "main" })).reason).toBe("not_recognised");
  });

  it("reports expiry at the gate and the scheduled job marks passes expired", async () => {
    const issued = await guestPass(a, window(0, 30));
    const later = new Date(Date.now() + 60 * 60_000);
    const result = await verifyVisitorPass(contextFor(a, "guard"), { method: "code", code: issued.code, gateId: "main" }, later);
    expect(result.reason).toBe("expired");
    expect(await expirePasses(adminDb(), later)).toBe(1);
    const pass = (await adminDb().collection(COLLECTIONS.visitorPasses).doc(issued.passId).get()).data()!;
    expect(pass.status).toBe("expired");
  });

  it("blocks guards at gates they are not assigned to and residents of other estates", async () => {
    const issued = await guestPass(a);
    await expect(verifyVisitorPass(contextFor(a, "guard"), { method: "code", code: issued.code, gateId: "back" })).rejects.toBeInstanceOf(AppError);
    await expect(revokeVisitorPass(contextFor(b, "resident"), issued.passId)).rejects.toMatchObject({ code: "not_found" });
    await expect(revokeVisitorPass(contextFor(b, "manager"), issued.passId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("enforces the active pass limit per unit", async () => {
    await adminDb().collection(COLLECTIONS.estates).doc("estate_a").update({ "settings.maxActivePassesPerUnit": 1 });
    const limited = { ...a, estate: { ...a.estate, settings: { ...a.estate.settings, maxActivePassesPerUnit: 1 } } };
    await guestPass(limited);
    await expect(guestPass(limited)).rejects.toMatchObject({ code: "conflict" });
  });

  it("records an exit once for an entry", async () => {
    const issued = await guestPass(a);
    const guard = contextFor(a, "guard");
    const entry = await verifyVisitorPass(guard, { method: "code", code: issued.code, gateId: "main" });
    await recordVisitorExit(guard, { gateId: "main", entryEventId: entry.eventId });
    await expect(recordVisitorExit(guard, { gateId: "main", entryEventId: entry.eventId })).rejects.toMatchObject({ code: "conflict" });
  });
});
