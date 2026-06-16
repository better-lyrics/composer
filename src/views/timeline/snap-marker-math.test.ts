import { describe, expect, it } from "vitest";
import { computeCoveredOnsets, snapTimeToOnset } from "@/views/timeline/snap-marker-math";

// -- Tests ---------------------------------------------------------------------

describe("snapTimeToOnset", () => {
  it("snaps to an onset within the pixel threshold", () => {
    expect(snapTimeToOnset(2.05, [2], 100, 12)).toBe(2);
  });

  it("leaves the time untouched when no onset is within threshold", () => {
    expect(snapTimeToOnset(2.5, [2], 100, 12)).toBe(2.5);
  });

  it("snaps just inside the threshold", () => {
    expect(snapTimeToOnset(2.11, [2], 100, 12)).toBe(2);
  });

  it("does not snap just beyond the threshold", () => {
    expect(snapTimeToOnset(2.13, [2], 100, 12)).toBe(2.13);
  });

  it("snaps to the nearest of several onsets", () => {
    expect(snapTimeToOnset(2.04, [2, 2.1], 100, 20)).toBe(2);
    expect(snapTimeToOnset(2.07, [2, 2.1], 100, 20)).toBe(2.1);
  });

  it("scales the threshold by zoom (lower zoom = wider time window)", () => {
    expect(snapTimeToOnset(2.2, [2], 50, 12)).toBe(2);
    expect(snapTimeToOnset(2.2, [2], 100, 12)).toBe(2.2);
  });

  describe("edge cases", () => {
    it("returns the input when there are no onsets", () => {
      expect(snapTimeToOnset(2, [], 100, 12)).toBe(2);
    });

    it("handles the timeline origin", () => {
      expect(snapTimeToOnset(0.05, [0], 100, 12)).toBe(0);
    });
  });
});

describe("computeCoveredOnsets", () => {
  it("marks an onset covered by a coincident custom point", () => {
    expect(computeCoveredOnsets([2], [2], 100, 12)).toEqual(new Set([0]));
  });

  it("marks an onset covered within threshold", () => {
    expect(computeCoveredOnsets([2], [2.1], 100, 12)).toEqual(new Set([0]));
  });

  it("does not cover an onset outside threshold", () => {
    expect(computeCoveredOnsets([2], [2.5], 100, 12)).toEqual(new Set());
  });

  it("covers by onset index, not value", () => {
    const covered = computeCoveredOnsets([1, 2, 3], [2], 100, 12);
    expect(covered.has(1)).toBe(true);
    expect(covered.has(0)).toBe(false);
    expect(covered.has(2)).toBe(false);
  });

  it("covers multiple onsets from multiple covering points", () => {
    expect(computeCoveredOnsets([1, 2, 3], [1, 3], 100, 12)).toEqual(new Set([0, 2]));
  });

  describe("edge cases", () => {
    it("returns empty when there are no covering times", () => {
      expect(computeCoveredOnsets([1, 2], [], 100, 12)).toEqual(new Set());
    });

    it("returns empty when there are no onsets", () => {
      expect(computeCoveredOnsets([], [2], 100, 12)).toEqual(new Set());
    });

    it("scales coverage window by zoom", () => {
      expect(computeCoveredOnsets([2], [2.2], 50, 12)).toEqual(new Set([0]));
      expect(computeCoveredOnsets([2], [2.2], 100, 12)).toEqual(new Set());
    });
  });
});
