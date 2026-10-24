import { loopRegionBetween, MIN_LOOP_REGION_SECONDS, overlapsLoopRegion } from "@/domain/selection/loop-region";
import { describe, expect, it } from "vitest";

describe("loopRegionBetween", () => {
  it("spans from the anchor to the pointer", () => {
    expect(loopRegionBetween(2, 5, 60)).toEqual({ begin: 2, end: 5 });
  });

  it("orders the edges when the pointer moves left of the anchor", () => {
    expect(loopRegionBetween(5, 2, 60)).toEqual({ begin: 2, end: 5 });
  });

  describe("edge cases", () => {
    it("clamps to the song start and end", () => {
      expect(loopRegionBetween(-1, 70, 60)).toEqual({ begin: 0, end: 60 });
    });

    it("does not clamp the end while the duration is unknown", () => {
      expect(loopRegionBetween(2, 70, 0)).toEqual({ begin: 2, end: 70 });
    });

    it("returns null for a region shorter than the minimum", () => {
      expect(loopRegionBetween(2, 2 + MIN_LOOP_REGION_SECONDS / 2, 60)).toBeNull();
    });

    it("returns null when both edges clamp to the same point", () => {
      expect(loopRegionBetween(61, 65, 60)).toBeNull();
    });
  });
});

describe("overlapsLoopRegion", () => {
  const region = { begin: 10, end: 12 };

  it("is true for a span inside or across the region", () => {
    expect(overlapsLoopRegion({ begin: 10.5, end: 11 }, region)).toBe(true);
    expect(overlapsLoopRegion({ begin: 9, end: 10.1 }, region)).toBe(true);
    expect(overlapsLoopRegion({ begin: 11.9, end: 13 }, region)).toBe(true);
  });

  it("is false for a span that only touches an edge", () => {
    expect(overlapsLoopRegion({ begin: 8, end: 10 }, region)).toBe(false);
    expect(overlapsLoopRegion({ begin: 12, end: 14 }, region)).toBe(false);
  });
});
