import { describe, expect, it } from "vitest";
import {
  adjacentSnapPoint,
  computeCoveredOnsets,
  findInsertedValue,
  isTimeOnOnset,
  snapTimeToOnset,
} from "@/views/timeline/snap-marker-math";

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

describe("isTimeOnOnset", () => {
  it("is true when a time sits exactly on an onset", () => {
    expect(isTimeOnOnset(2, [2], 100, 12)).toBe(true);
  });

  it("is true within the pixel threshold", () => {
    expect(isTimeOnOnset(2.1, [2], 100, 12)).toBe(true);
  });

  it("is false outside the pixel threshold", () => {
    expect(isTimeOnOnset(2.5, [2], 100, 12)).toBe(false);
  });

  it("is true if any onset is within threshold", () => {
    expect(isTimeOnOnset(3, [1, 3, 5], 100, 12)).toBe(true);
  });

  it("scales the window by zoom (lower zoom = wider time window)", () => {
    expect(isTimeOnOnset(2.2, [2], 50, 12)).toBe(true);
    expect(isTimeOnOnset(2.2, [2], 100, 12)).toBe(false);
  });

  describe("edge cases", () => {
    it("is false when there are no onsets", () => {
      expect(isTimeOnOnset(2, [], 100, 12)).toBe(false);
    });

    it("handles the timeline origin", () => {
      expect(isTimeOnOnset(0.05, [0], 100, 12)).toBe(true);
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

describe("findInsertedValue", () => {
  it("returns the appended value", () => {
    expect(findInsertedValue([1, 3], [1, 3, 5])).toBe(5);
  });

  it("returns the middle-inserted value", () => {
    expect(findInsertedValue([1, 3], [1, 2, 3])).toBe(2);
  });

  it("returns the prepended value", () => {
    expect(findInsertedValue([2, 3], [1, 2, 3])).toBe(1);
  });

  it("returns null on a move (same length, one value changed)", () => {
    expect(findInsertedValue([2, 4], [4, 6])).toBeNull();
  });

  it("returns null on a delete (shorter)", () => {
    expect(findInsertedValue([1, 2, 3], [1, 3])).toBeNull();
  });

  it("returns null when nothing changed", () => {
    expect(findInsertedValue([1, 2, 3], [1, 2, 3])).toBeNull();
  });

  describe("edge cases", () => {
    it("returns null for empty to empty", () => {
      expect(findInsertedValue([], [])).toBeNull();
    });

    it("returns the only value when adding the first point", () => {
      expect(findInsertedValue([], [4])).toBe(4);
    });

    it("returns null when the array grows by more than one", () => {
      expect(findInsertedValue([1], [1, 2, 3])).toBeNull();
    });

    it("returns null when count rises by one but no value is genuinely new", () => {
      // A duplicate of an existing value: next-minus-prev is empty, so no fresh value.
      expect(findInsertedValue([2, 2], [2, 2, 2])).toBeNull();
    });

    it("returns the inserted value at the timeline origin", () => {
      expect(findInsertedValue([2], [0, 2])).toBe(0);
    });

    it("treats a non-trivial first render (prev seeded to current) as no insertion", () => {
      // When the prev-ref is initialized to the initial array, the first diff is
      // identical, so nothing is flagged new on mount.
      const initial = [1, 4, 7];
      expect(findInsertedValue(initial, initial)).toBeNull();
    });
  });
});

describe("adjacentSnapPoint", () => {
  it("returns the smallest point strictly greater than current when going next", () => {
    expect(adjacentSnapPoint([1, 5, 12], 5, 1)).toBe(12);
  });

  it("returns the largest point strictly less than current when going prev", () => {
    expect(adjacentSnapPoint([1, 5, 12], 5, -1)).toBe(1);
  });

  it("finds the next point from a time between two points", () => {
    expect(adjacentSnapPoint([1, 5, 12], 4, 1)).toBe(5);
  });

  it("finds the prev point from a time between two points", () => {
    expect(adjacentSnapPoint([1, 5, 12], 6, -1)).toBe(5);
  });

  describe("edge cases", () => {
    it("returns null when there is no point ahead", () => {
      expect(adjacentSnapPoint([1, 5, 12], 12, 1)).toBeNull();
    });

    it("returns null when there is no point behind", () => {
      expect(adjacentSnapPoint([1, 5, 12], 1, -1)).toBeNull();
    });

    it("returns null for an empty array going next", () => {
      expect(adjacentSnapPoint([], 5, 1)).toBeNull();
    });

    it("returns null for an empty array going prev", () => {
      expect(adjacentSnapPoint([], 5, -1)).toBeNull();
    });

    it("skips a point exactly on current and returns the next distinct point", () => {
      expect(adjacentSnapPoint([1, 5, 12], 5, 1)).toBe(12);
    });

    it("skips a point exactly on current going prev and returns the previous distinct point", () => {
      expect(adjacentSnapPoint([1, 5, 12], 5, -1)).toBe(1);
    });

    it("skips a point within epsilon of current going next", () => {
      expect(adjacentSnapPoint([5, 12], 5.00005, 1)).toBe(12);
    });

    it("skips a point within epsilon of current going prev", () => {
      expect(adjacentSnapPoint([1, 5], 4.99995, -1)).toBe(1);
    });

    it("returns the first point for a current before all points going next", () => {
      expect(adjacentSnapPoint([1, 5, 12], 0, 1)).toBe(1);
    });

    it("returns the last point for a current after all points going prev", () => {
      expect(adjacentSnapPoint([1, 5, 12], 20, -1)).toBe(12);
    });

    it("returns null for a current after all points going next", () => {
      expect(adjacentSnapPoint([1, 5, 12], 20, 1)).toBeNull();
    });

    it("returns null for a current before all points going prev", () => {
      expect(adjacentSnapPoint([1, 5, 12], 0, -1)).toBeNull();
    });

    it("handles a single-element array going next", () => {
      expect(adjacentSnapPoint([5], 4, 1)).toBe(5);
      expect(adjacentSnapPoint([5], 6, 1)).toBeNull();
    });

    it("handles a single-element array going prev", () => {
      expect(adjacentSnapPoint([5], 6, -1)).toBe(5);
      expect(adjacentSnapPoint([5], 4, -1)).toBeNull();
    });

    it("returns the first point for a negative current going next", () => {
      expect(adjacentSnapPoint([0, 3, 8], -2, 1)).toBe(0);
    });

    it("handles the timeline origin as a target", () => {
      expect(adjacentSnapPoint([0, 3], -0.5, 1)).toBe(0);
    });
  });
});
