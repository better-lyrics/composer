import { describe, expect, it } from "vitest";
import { computeAnchoredScrollLeft } from "@/utils/timeline/zoom-anchor";

describe("computeAnchoredScrollLeft", () => {
  describe("happy paths", () => {
    it("keeps anchor stable when zooming in", () => {
      const anchorTime = 5;
      const anchorViewportX = 200;
      const newZoom = 120;
      const scroll = computeAnchoredScrollLeft(anchorTime, anchorViewportX, newZoom);
      expect(anchorTime * newZoom - scroll).toBeCloseTo(anchorViewportX);
    });

    it("keeps anchor stable when zooming out", () => {
      const anchorTime = 5;
      const anchorViewportX = 200;
      const newZoom = 80;
      const scroll = computeAnchoredScrollLeft(anchorTime, anchorViewportX, newZoom);
      expect(anchorTime * newZoom - scroll).toBeCloseTo(anchorViewportX);
    });

    it("is identity when newZoom equals oldZoom-derived scroll", () => {
      const anchorTime = 3;
      const anchorViewportX = 100;
      const scroll = computeAnchoredScrollLeft(anchorTime, anchorViewportX, 100);
      expect(scroll).toBe(anchorTime * 100 - anchorViewportX);
    });
  });

  describe("edge cases", () => {
    it("clamps to 0 when math would go negative (left edge)", () => {
      const scroll = computeAnchoredScrollLeft(0.1, 500, 100);
      expect(scroll).toBe(0);
    });

    it("returns 0 for anchorTime 0 at left edge", () => {
      const scroll = computeAnchoredScrollLeft(0, 0, 200);
      expect(scroll).toBe(0);
    });

    it("returns 0 when anchorTime is 0 regardless of anchorViewportX", () => {
      const scroll = computeAnchoredScrollLeft(0, 250, 200);
      expect(scroll).toBe(0);
    });

    it("handles very small anchorViewportX at high zoom", () => {
      const scroll = computeAnchoredScrollLeft(10, 1, 500);
      expect(scroll).toBe(4999);
    });

    it("handles fractional zoom values", () => {
      const scroll = computeAnchoredScrollLeft(5, 100, 33.33);
      expect(scroll).toBeCloseTo(5 * 33.33 - 100);
    });
  });

  describe("invariants", () => {
    it("always returns a non-negative number", () => {
      const samples = [
        [0, 0, 20],
        [0.5, 1000, 20],
        [50, 50, 500],
        [0, 100, 100],
        [100, 0, 20],
      ] as const;
      for (const [t, x, z] of samples) {
        expect(computeAnchoredScrollLeft(t, x, z)).toBeGreaterThanOrEqual(0);
      }
    });

    it("is pure (no mutation, deterministic)", () => {
      const a = computeAnchoredScrollLeft(5, 200, 100);
      const b = computeAnchoredScrollLeft(5, 200, 100);
      expect(a).toBe(b);
    });
  });
});
