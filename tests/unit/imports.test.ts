import { describe, expect, it } from "vitest";
import { planResidentImport, unitKey } from "@/lib/imports/residents";

const existing = {
  unitsByKey: new Map([[unitKey("2A", "Palm Close"), "unit_2a"]]),
  knownEmails: new Set(["already@estate.ng"]),
  knownPhones: new Set<string>(),
};

describe("resident CSV import planning", () => {
  it("plans new units, invitations, existing units and duplicates", () => {
    const csv = [
      "Unit Label,Block,Floor,Resident Name,Resident Email,Resident Phone",
      "14B,Palm Close,,Adaeze Okafor,ADAEZE@estate.ng,0803 123 4567",
      "14B,Palm Close,,Tunde Okafor,tunde@estate.ng,",
      "2A,Palm Close,1,Bola Ade,already@estate.ng,",
      "7,Iroko Road,,Kemi Bello,adaeze@estate.ng,",
      "9,Iroko Road,,,,",
    ].join("\n");
    const plan = planResidentImport(csv, existing);
    expect(plan.fileErrors).toEqual([]);
    expect(plan.rows.map((row) => [row.unitAction, row.residentAction])).toEqual([
      ["create", "invite"],
      ["existing", "invite"],
      ["existing", "skip_existing"],
      ["create", "skip_duplicate"],
      ["create", "none"],
    ]);
    expect(plan.rows[0]!.residentEmail).toBe("adaeze@estate.ng");
    expect(plan.rows[0]!.residentPhone).toBe("+2348031234567");
    expect(plan.rows[2]!.existingUnitId).toBe("unit_2a");
    expect(plan.summary).toMatchObject({ totalRows: 5, unitsToCreate: 3, invitesToSend: 2, duplicates: 2, errorRows: 0 });
  });

  it("reports row level errors without blocking valid rows", () => {
    const csv = "unit_label,resident_name,resident_email,resident_phone\n,Ada,ada@estate.ng,\n3,Ada,not an email,\n4,X,,\n5,Sola,,0700\n6,Sola Ade,,08031112222";
    const plan = planResidentImport(csv, existing);
    expect(plan.rows.map((row) => row.errors.length > 0)).toEqual([true, true, true, true, false]);
    expect(plan.summary.validRows).toBe(1);
  });

  it("blocks files without a unit_label column", () => {
    const plan = planResidentImport("name,email\nAda,ada@estate.ng", existing);
    expect(plan.rows).toEqual([]);
    expect(plan.fileErrors[0]).toMatch(/unit_label/);
  });
});
