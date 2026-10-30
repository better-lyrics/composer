import {
  clampLoupeSize,
  fitLoupeSize,
  isDefaultLoupeSize,
  LOUPE_SIZE,
  resizedLoupe,
} from "@/domain/spectrum/loupe-size";
import { describe, expect, it } from "vitest";

describe("clampLoupeSize", () => {
  it("keeps a valid size", () => {
    expect(clampLoupeSize({ width: 500, height: 200 })).toEqual({ width: 500, height: 200 });
  });

  it("snaps to the 4 px step and clamps to the range", () => {
    expect(clampLoupeSize({ width: 999, height: 1 })).toEqual({ width: 720, height: 96 });
    expect(clampLoupeSize({ width: 431, height: 125 })).toEqual({ width: 432, height: 124 });
  });

  describe("edge cases", () => {
    it("falls back to the defaults for non-finite values", () => {
      expect(clampLoupeSize({ width: Number.NaN, height: Number.POSITIVE_INFINITY })).toEqual({
        width: LOUPE_SIZE.width.default,
        height: LOUPE_SIZE.height.default,
      });
    });
  });
});

describe("fitLoupeSize", () => {
  it("leaves a size that fits alone", () => {
    expect(fitLoupeSize({ width: 428, height: 124 }, { width: 1440, height: 900 })).toEqual({
      width: 428,
      height: 124,
    });
  });

  it("shrinks to the largest size the viewport holds, never below the minimum", () => {
    const fitted = fitLoupeSize({ width: 720, height: 400 }, { width: 600, height: 400 });
    expect(fitted.width).toBeLessThan(720);
    expect(fitted.height).toBeLessThan(400);
    expect(fitLoupeSize({ width: 720, height: 400 }, { width: 10, height: 10 })).toEqual({ width: 320, height: 96 });
  });

  it("gives up height to space reserved above the loupe", () => {
    const viewport = { width: 1440, height: 600 };
    expect(fitLoupeSize({ width: 720, height: 400 }, viewport, 100).height).toBeLessThan(
      fitLoupeSize({ width: 720, height: 400 }, viewport).height,
    );
  });
});

describe("resizedLoupe", () => {
  const start = { width: 428, height: 124 };
  const limits = { width: 720, height: 400 };

  it("grows width twice the pointer delta because the card is centred, height one to one", () => {
    expect(resizedLoupe(start, { x: 40, y: 40 }, "xy", limits)).toEqual({ width: 508, height: 164 });
  });

  it("moves only its axis", () => {
    expect(resizedLoupe(start, { x: 40, y: 40 }, "x", limits)).toEqual({ width: 508, height: 124 });
    expect(resizedLoupe(start, { x: 40, y: 40 }, "y", limits)).toEqual({ width: 428, height: 164 });
  });

  it("stops at the limits", () => {
    expect(resizedLoupe(start, { x: 900, y: 900 }, "xy", limits)).toEqual(limits);
    expect(resizedLoupe(start, { x: 900, y: 900 }, "xy", { width: 500, height: 200 })).toEqual({
      width: 500,
      height: 200,
    });
  });

  it("never shrinks below the minimum", () => {
    expect(resizedLoupe(start, { x: -900, y: -900 }, "xy", limits)).toEqual({ width: 320, height: 96 });
  });
});

describe("isDefaultLoupeSize", () => {
  it("is true only for the default size", () => {
    expect(isDefaultLoupeSize({ width: LOUPE_SIZE.width.default, height: LOUPE_SIZE.height.default })).toBe(true);
    expect(isDefaultLoupeSize({ width: 432, height: LOUPE_SIZE.height.default })).toBe(false);
  });
});
