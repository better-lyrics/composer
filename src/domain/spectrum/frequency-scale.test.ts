import { frequencyAtRow, rowBinTable, rowOfFrequency, topFrequencyRange } from "@/domain/spectrum/frequency-scale";
import { describe, expect, it } from "vitest";

describe("frequency scale", () => {
  it("maps the top row to the top frequency and the bottom edge to the floor", () => {
    const [low, high] = topFrequencyRange("full");
    expect(low).toBe(80);
    expect(high).toBe(18000);
    expect(frequencyAtRow("mel", "full", 0, 100)).toBeCloseTo(18000, 0);
    expect(frequencyAtRow("mel", "full", 100, 100)).toBeCloseTo(80, 0);
  });

  it("round-trips a frequency through a row on every scale", () => {
    for (const scale of ["mel", "log", "linear"] as const) {
      const row = rowOfFrequency(scale, "full", 1000, 400);
      expect(frequencyAtRow(scale, "full", row, 400)).toBeCloseTo(1000, 0);
    }
  });

  it("gives mel more rows to low frequencies than linear", () => {
    const melRow = rowOfFrequency("mel", "full", 1000, 400);
    const linearRow = rowOfFrequency("linear", "full", 1000, 400);
    expect(melRow).toBeLessThan(linearRow);
  });

  describe("bin tables", () => {
    it("interpolates rows narrower than a bin and spans rows wider than one", () => {
      const table = rowBinTable("mel", "full", 168, 2048, 44100);
      const bottom = 167;
      expect(table.spanEnd[bottom]).toBe(-1);
      expect(table.fraction[bottom]).toBeGreaterThanOrEqual(0);
      expect(table.spanEnd[0]).toBeGreaterThan(table.spanStart[0]);
    });

    it("never indexes past the last bin", () => {
      const table = rowBinTable("linear", "full", 320, 1024, 44100);
      const bins = 1024 / 2 + 1;
      for (let row = 0; row < 320; row++) {
        expect(table.spanStart[row]).toBeLessThan(bins);
        expect(table.spanEnd[row]).toBeLessThanOrEqual(bins);
      }
    });

    it("tilts rows above 500 Hz by 1.5 dB per octave and leaves lower rows flat", () => {
      const table = rowBinTable("mel", "full", 168, 2048, 44100);
      expect(table.tiltDb[167]).toBe(0);
      expect(table.tiltDb[0]).toBeCloseTo(1.5 * Math.log2(18000 / 500), 0);
    });
  });
});
