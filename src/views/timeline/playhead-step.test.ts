import { describe, expect, it } from "vitest";
import { steppedTime, viewportSeconds } from "@/views/timeline/playhead-step";
import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";

describe("steppedTime", () => {
  it("steps forward by the given delta", () => {
    expect(steppedTime(10, 0.05, 60)).toBeCloseTo(10.05, 5);
  });

  it("steps backward by a negative delta", () => {
    expect(steppedTime(10, -0.05, 60)).toBeCloseTo(9.95, 5);
  });

  describe("edge cases", () => {
    it("clamps to zero when stepping back past the start", () => {
      expect(steppedTime(0.02, -0.05, 60)).toBe(0);
    });

    it("clamps to duration when stepping past the end", () => {
      expect(steppedTime(59.99, 0.05, 60)).toBe(60);
    });

    it("returns zero for a zero-length track", () => {
      expect(steppedTime(0, 0.05, 0)).toBe(0);
    });

    it("treats a negative duration as zero rather than inverting the range", () => {
      expect(steppedTime(5, 0.05, -1)).toBe(0);
    });

    it("pulls a playhead already past the end back to the end", () => {
      expect(steppedTime(90, 0.05, 60)).toBe(60);
    });

    it("leaves the time unchanged for a zero delta inside the range", () => {
      expect(steppedTime(30, 0, 60)).toBe(30);
    });
  });

  describe("invariants", () => {
    it("never leaves the range for any delta", () => {
      for (const delta of [-1000, -0.001, 0, 0.001, 1000]) {
        const result = steppedTime(30, delta, 60);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(60);
      }
    });

    it("is a no-op at a boundary when stepping further out", () => {
      expect(steppedTime(0, -0.05, 60)).toBe(0);
      expect(steppedTime(60, 0.05, 60)).toBe(60);
    });

    it("is symmetric: stepping out and back returns the original time", () => {
      expect(steppedTime(steppedTime(30, 0.05, 60), -0.05, 60)).toBeCloseTo(30, 5);
    });
  });
});

describe("viewportSeconds", () => {
  it("excludes the gutter from the visible span", () => {
    expect(viewportSeconds(GUTTER_WIDTH + 500, 100)).toBeCloseTo(5, 5);
  });

  it("shrinks as zoom increases", () => {
    const wide = viewportSeconds(GUTTER_WIDTH + 1000, 20);
    const tight = viewportSeconds(GUTTER_WIDTH + 1000, 500);
    expect(tight).toBeLessThan(wide);
  });

  describe("edge cases", () => {
    it("returns zero when the viewport is narrower than the gutter", () => {
      expect(viewportSeconds(GUTTER_WIDTH - 10, 100)).toBe(0);
    });

    it("returns zero when the viewport is exactly the gutter", () => {
      expect(viewportSeconds(GUTTER_WIDTH, 100)).toBe(0);
    });

    it("returns zero for a zero zoom rather than dividing by zero", () => {
      expect(viewportSeconds(GUTTER_WIDTH + 500, 0)).toBe(0);
    });

    it("returns zero for a negative zoom rather than a negative span", () => {
      expect(viewportSeconds(GUTTER_WIDTH + 500, -100)).toBe(0);
    });
  });

  describe("invariants", () => {
    it("is never negative for any input", () => {
      for (const width of [-500, 0, GUTTER_WIDTH, GUTTER_WIDTH + 2000]) {
        for (const zoom of [-1, 0, 20, 500]) {
          expect(viewportSeconds(width, zoom)).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });
});
