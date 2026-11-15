import { beforeEach, describe, expect, it } from "vitest";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { pilotRequestSchema } from "@/lib/validation/estates";
import { recordPilotRequest } from "@/server/services/estates";
import { clearFirestore } from "./fixtures";

const valid = {
  name: "Folake Adeyemi",
  email: "folake@akobogardens.ng",
  phone: "0803 123 4567",
  estateName: "Akobo Gardens",
  city: "Ibadan",
  units: 120,
  message: "",
  website: "",
};

async function stored() {
  return (await adminDb().collection(COLLECTIONS.pilotRequests).count().get()).data().count;
}

beforeEach(clearFirestore);

describe("pilot request spam protection", () => {
  it("stores a genuine request", async () => {
    await recordPilotRequest(pilotRequestSchema.parse({ ...valid, elapsedMs: 42_000 }), { ipHash: null });
    expect(await stored()).toBe(1);
  });

  it("silently drops honeypot and instant submissions", async () => {
    await recordPilotRequest(pilotRequestSchema.parse({ ...valid, website: "https://spam.example" }), { ipHash: null });
    await recordPilotRequest(pilotRequestSchema.parse({ ...valid, elapsedMs: 400 }), { ipHash: null });
    expect(await stored()).toBe(0);
  });

  it("rejects malformed input with field errors", () => {
    const result = pilotRequestSchema.safeParse({ ...valid, email: "nope", phone: "123", units: 2 });
    expect(result.success).toBe(false);
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["email", "phone", "units"]);
  });
});
