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

    it("returns the unclamped anchorTime * newZoom - anchorViewportX for the typical positive case", () => {
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
      const samples: Array<{ t: number; x: number; z: number }> = [
        { t: 0, x: 0, z: 20 },
        { t: 0.5, x: 1000, z: 20 },
        { t: 50, x: 50, z: 500 },
        { t: 0, x: 100, z: 100 },
        { t: 100, x: 0, z: 20 },
      ];
      for (const { t, x, z } of samples) {
        expect(computeAnchoredScrollLeft(t, x, z)).toBeGreaterThanOrEqual(0);
      }
    });

    it("invariant: anchor stays under the same viewport X when unclamped", () => {
      const cases: Array<{ t: number; x: number; z: number }> = [
        { t: 5, x: 200, z: 80 },
        { t: 5, x: 200, z: 120 },
        { t: 10, x: 50, z: 500 },
        { t: 0.5, x: 5, z: 100 },
        { t: 3, x: 100, z: 100 },
      ];
      for (const { t, x, z } of cases) {
        const scroll = computeAnchoredScrollLeft(t, x, z);
        if (t * z >= x) {
          expect(t * z - scroll).toBeCloseTo(x);
        }
      }
    });

    it("invariant: non-decreasing in newZoom for fixed anchor (zoom in moves scroll right or holds)", () => {
      const t = 5;
      const x = 200;
      const a = computeAnchoredScrollLeft(t, x, 80);
      const b = computeAnchoredScrollLeft(t, x, 100);
      const c = computeAnchoredScrollLeft(t, x, 200);
      expect(a).toBeLessThanOrEqual(b);
      expect(b).toBeLessThanOrEqual(c);
    });
  });
});
