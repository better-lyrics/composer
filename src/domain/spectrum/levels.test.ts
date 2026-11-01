import { brightness, decodeDb, encodeDb } from "@/domain/spectrum/levels";
import { paletteLookup } from "@/domain/spectrum/palettes";
import { describe, expect, it } from "vitest";

describe("spectrum levels", () => {
  it("encodes the 120 dB range into a byte", () => {
    expect(encodeDb(-120)).toBe(0);
    expect(encodeDb(0)).toBe(255);
  });

  it("round-trips within half a step", () => {
    expect(Math.abs(decodeDb(encodeDb(-40)) + 40)).toBeLessThan(0.25);
  });

  it("maps the contrast floor to dark and the ceiling to full", () => {
    expect(brightness(-72, -72)).toBe(0);
    expect(brightness(-8, -72)).toBe(1);
  });

  describe("edge cases", () => {
    it("clamps outside the range", () => {
      expect(encodeDb(-500)).toBe(0);
      expect(encodeDb(30)).toBe(255);
      expect(brightness(-110, -72)).toBe(0);
      expect(brightness(5, -72)).toBe(1);
    });
  });
});

describe("paletteLookup", () => {
  it("interpolates a two stop ramp", () => {
    const lookup = paletteLookup([
      [0, [0, 0, 0]],
      [1, [255, 255, 255]],
    ]);
    expect(lookup.r[0]).toBe(0);
    expect(lookup.r[255]).toBe(255);
    expect(Math.abs(lookup.r[128] - 128)).toBeLessThanOrEqual(1);
  });
});
