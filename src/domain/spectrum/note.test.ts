import { noteOfFrequency } from "@/domain/spectrum/note";
import { describe, expect, it } from "vitest";

describe("noteOfFrequency", () => {
  it("names A4 at 440 Hz with no cents", () => {
    expect(noteOfFrequency(440)).toEqual({ name: "A4", cents: 0 });
  });
  it("rounds to the nearest note and reports signed cents", () => {
    expect(noteOfFrequency(452)).toEqual({ name: "A4", cents: 47 });
    expect(noteOfFrequency(261.63)).toEqual({ name: "C4", cents: 0 });
  });
  describe("edge cases", () => {
    it("returns null for silence and non-finite input", () => {
      expect(noteOfFrequency(0)).toBeNull();
      expect(noteOfFrequency(Number.NaN)).toBeNull();
    });
  });
});
