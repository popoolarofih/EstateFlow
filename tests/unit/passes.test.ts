import { describe, expect, it } from "vitest";
import { createQrToken, createSixDigitCode, hashPassCode, hashQrToken, safeEqualHex } from "@/lib/passes/codes";
import { evaluatePass, guardMessage, statusAfterUse, withinRecurrence, type EvaluablePass } from "@/lib/passes/evaluate";
import { decodeQrPayload, encodeQrPayload } from "@/lib/passes/qr";

const SECRET = "unit-test-secret-unit-test-secret-0000";
const now = new Date("2026-11-14T12:00:00Z"); // Saturday 13:00 in Lagos

function pass(overrides: Partial<EvaluablePass> = {}): EvaluablePass {
  return {
    status: "active",
    validFrom: new Date("2026-11-14T08:00:00Z"),
    validUntil: new Date("2026-11-14T18:00:00Z"),
    maxUses: 1,
    useCount: 0,
    allowedGateIds: [],
    recurrence: null,
    ...overrides,
  };
}

describe("pass codes", () => {
  it("creates zero padded six digit codes", () => {
    for (let i = 0; i < 500; i += 1) expect(createSixDigitCode()).toMatch(/^\d{6}$/);
  });

  it("binds the hash to the estate so codes never collide across estates", () => {
    const a = hashPassCode("estateA", "123456", SECRET);
    expect(a).toBe(hashPassCode("estateA", "123456", SECRET));
    expect(a).not.toBe(hashPassCode("estateB", "123456", SECRET));
    expect(a).not.toBe(hashPassCode("estateA", "123457", SECRET));
    expect(a).not.toContain("123456");
  });

  it("rejects short HMAC secrets", () => {
    expect(() => hashPassCode("estateA", "123456", "short")).toThrow();
  });

  it("creates high entropy QR tokens and compares hashes in constant time", () => {
    const token = createQrToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createQrToken()).not.toBe(token);
    expect(safeEqualHex(hashQrToken(token), hashQrToken(token))).toBe(true);
    expect(safeEqualHex(hashQrToken(token), hashQrToken(createQrToken()))).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });

  it("round trips the QR payload and rejects malformed ones", () => {
    const payload = { v: 1 as const, passId: "pass_abcdefghijklmnop", estateId: "estateA", token: createQrToken() };
    expect(decodeQrPayload(encodeQrPayload(payload))).toEqual(payload);
    expect(decodeQrPayload("not json")).toBeNull();
    expect(decodeQrPayload(JSON.stringify({ ...payload, v: 2 }))).toBeNull();
    expect(decodeQrPayload(JSON.stringify({ ...payload, token: "short" }))).toBeNull();
  });
});

describe("evaluatePass", () => {
  const ctx = { now, gateId: "main", timezone: "Africa/Lagos" };

  it("allows a valid pass", () => {
    expect(evaluatePass(pass(), ctx)).toEqual({ allow: true, reason: "valid" });
  });

  it("denies unknown passes without detail", () => {
    expect(evaluatePass(null, ctx)).toEqual({ allow: false, reason: "not_recognised" });
  });

  it.each([
    [{ status: "revoked" as const }, "revoked"],
    [{ status: "expired" as const }, "expired"],
    [{ validUntil: new Date("2026-11-14T11:59:59Z") }, "expired"],
    [{ status: "used" as const }, "already_used"],
    [{ useCount: 1 }, "already_used"],
    [{ validFrom: new Date("2026-11-14T12:30:00Z") }, "not_yet_valid"],
    [{ allowedGateIds: ["back"] }, "wrong_gate"],
  ])("denies %o as %s", (overrides, reason) => {
    expect(evaluatePass(pass(overrides), ctx)).toEqual({ allow: false, reason });
  });

  it("prefers revoked over every other reason", () => {
    expect(evaluatePass(pass({ status: "revoked", useCount: 5 }), ctx).reason).toBe("revoked");
  });

  it("allows unlimited staff passes inside the recurring window only", () => {
    const staff = pass({
      maxUses: null,
      useCount: 40,
      validUntil: new Date("2027-01-01T00:00:00Z"),
      recurrence: { daysOfWeek: [1, 2, 3, 4, 5], startTime: "07:00", endTime: "18:00" },
    });
    // Saturday: outside allowed days
    expect(evaluatePass(staff, ctx).reason).toBe("outside_schedule");
    // Monday 16 Nov 2026 09:00 Lagos = 08:00Z
    expect(evaluatePass(staff, { ...ctx, now: new Date("2026-11-16T08:00:00Z") })).toEqual({ allow: true, reason: "valid" });
    // Monday 19:00 Lagos
    expect(evaluatePass(staff, { ...ctx, now: new Date("2026-11-16T18:00:00Z") }).reason).toBe("outside_schedule");
  });

  it("handles overnight windows in the estate timezone", () => {
    const recurrence = { daysOfWeek: [5], startTime: "20:00", endTime: "06:00" }; // Friday night
    expect(withinRecurrence(recurrence, new Date("2026-11-13T21:00:00Z"), "Africa/Lagos")).toBe(true); // Fri 22:00
    expect(withinRecurrence(recurrence, new Date("2026-11-14T04:00:00Z"), "Africa/Lagos")).toBe(true); // Sat 05:00
    expect(withinRecurrence(recurrence, new Date("2026-11-14T06:00:00Z"), "Africa/Lagos")).toBe(false); // Sat 07:00
    expect(withinRecurrence(recurrence, new Date("2026-11-12T21:00:00Z"), "Africa/Lagos")).toBe(false); // Thu 22:00
  });

  it("marks a single use pass as used after entry", () => {
    expect(statusAfterUse({ maxUses: 1, useCount: 0 })).toBe("used");
    expect(statusAfterUse({ maxUses: 3, useCount: 1 })).toBe("active");
    expect(statusAfterUse({ maxUses: null, useCount: 99 })).toBe("active");
  });

  it("maps every decision to plain language with a non colour signal", () => {
    expect(guardMessage("valid")).toMatchObject({ tone: "allow", headline: "Allow entry" });
    expect(guardMessage("not_recognised")).toMatchObject({ tone: "deny", headline: "Do not allow" });
    expect(guardMessage("expired").headline).toBe("Pass expired");
    expect(guardMessage("revoked").headline).toBe("Pass revoked");
    expect(guardMessage("already_used")).toMatchObject({ tone: "caution", headline: "Pass already used" });
  });
});
