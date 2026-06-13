import { describe, expect, it } from "vitest";
import { synthPeaks } from "@/utils/library/synth-peaks";

describe("synthPeaks", () => {
  it("returns identical arrays for the same seed and count", () => {
    const a = synthPeaks("song-id", 64);
    const b = synthPeaks("song-id", 64);
    expect(a).toEqual(b);
  });

  it("returns different arrays for different seeds (high probability)", () => {
    const a = synthPeaks("song-a", 64);
    const b = synthPeaks("song-b", 64);
    expect(a).not.toEqual(b);
  });

  it("returns an array of length count when count > 0", () => {
    expect(synthPeaks("x", 64)).toHaveLength(64);
    expect(synthPeaks("x", 16)).toHaveLength(16);
    expect(synthPeaks("x", 1)).toHaveLength(1);
  });

  it("returns peaks in [0, 1]", () => {
    const peaks = synthPeaks("anything", 256);
    for (const p of peaks) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  describe("edge cases", () => {
    it("returns [] when count is 0", () => {
      expect(synthPeaks("anything", 0)).toEqual([]);
    });

    it("returns [] when count is negative", () => {
      expect(synthPeaks("anything", -5)).toEqual([]);
    });

    it("handles the empty seed deterministically", () => {
      expect(synthPeaks("", 32)).toEqual(synthPeaks("", 32));
    });

    it("produces near-zero envelope at the endpoints", () => {
      const peaks = synthPeaks("envelope", 64);
      const first = peaks[0];
      const last = peaks[peaks.length - 1];
      expect(first).toBeLessThan(0.1);
      expect(last).toBeLessThan(0.1);
    });
  });

  describe("invariants", () => {
    it("does not mutate when called twice", () => {
      const a = synthPeaks("seed", 32);
      const snapshot = [...a];
      synthPeaks("seed", 32);
      expect(a).toEqual(snapshot);
    });

    it("returns a new array reference each call", () => {
      const a = synthPeaks("seed", 8);
      const b = synthPeaks("seed", 8);
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });
});
