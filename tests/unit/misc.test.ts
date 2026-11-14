import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";
import { formatNaira, parseNairaToKobo, sumKobo } from "@/lib/money";
import { consumeWindow } from "@/lib/rate-limit-window";
import { imageDimensions } from "@/lib/uploads";
import { normalizeNigerianPhone } from "@/lib/validation/common";

describe("money", () => {
  it("formats kobo exactly", () => {
    expect(formatNaira(5_000_000)).toBe("₦50,000.00");
    expect(formatNaira(123_456_789_01)).toBe("₦123,456,789.01");
    expect(formatNaira(5)).toBe("₦0.05");
  });

  it("parses naira input without floating point", () => {
    expect(parseNairaToKobo("50,000")).toBe(5_000_000);
    expect(parseNairaToKobo("₦1,250.5")).toBe(125_050);
    expect(parseNairaToKobo("0.07")).toBe(7);
    expect(parseNairaToKobo("1.005")).toBeNull();
    expect(parseNairaToKobo("-5")).toBeNull();
    expect(parseNairaToKobo("abc")).toBeNull();
  });

  it("sums only valid kobo values", () => {
    expect(sumKobo([1, 2, 3])).toBe(6);
    expect(() => sumKobo([1.5])).toThrow();
  });
});

describe("csv export", () => {
  it("quotes and neutralises spreadsheet formulas", () => {
    expect(escapeCsvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(escapeCsvCell("+2348031234567")).toBe("'+2348031234567");
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell(null)).toBe("");
    expect(toCsv([{ a: 1 }], [{ header: "A", value: (row) => row.a }])).toBe("A\r\n1\r\n");
  });
});

describe("rate limit window", () => {
  it("allows up to the limit and resets after the window", () => {
    let state = null;
    for (let i = 0; i < 3; i += 1) {
      const decision = consumeWindow(state, 1000, 3, 60_000);
      expect(decision.allowed).toBe(true);
      state = decision.next;
    }
    const blocked = consumeWindow(state, 2000, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(59);
    expect(consumeWindow(state, 61_001, 3, 60_000).allowed).toBe(true);
  });
});

describe("phone normalisation", () => {
  it.each([
    ["0803 123 4567", "+2348031234567"],
    ["+234 803 123 4567", "+2348031234567"],
    ["2348031234567", "+2348031234567"],
    ["0701-234-5678", "+2347012345678"],
  ])("%s", (input, expected) => expect(normalizeNigerianPhone(input)).toBe(expected));

  it("rejects invalid numbers", () => {
    expect(normalizeNigerianPhone("0603 123 4567")).toBeNull();
    expect(normalizeNigerianPhone("12345")).toBeNull();
  });
});

describe("upload image dimensions", () => {
  it("reads PNG headers", () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    expect(imageDimensions(png, "image/png")).toEqual({ width: 640, height: 480 });
  });

  it("reads JPEG start of frame", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03]);
    expect(imageDimensions(jpeg, "image/jpeg")).toEqual({ width: 640, height: 480 });
  });
});
