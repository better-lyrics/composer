import { type TileInputs, tileKey, visibleTileRange } from "@/domain/spectrum/tile-key";
import { describe, expect, it } from "vitest";

const BASE: TileInputs = {
  analysisGeneration: 1,
  pixelsPerSecond: 100,
  height: 168,
  scale: "mel",
  top: "full",
  palette: "heat",
  phase: "change",
  contrastDb: -72,
  themeGeneration: 0,
  index: 3,
};

const CHANGED: TileInputs = {
  analysisGeneration: 2,
  pixelsPerSecond: 120,
  height: 336,
  scale: "log",
  top: "voice",
  palette: "theme",
  phase: "raw",
  contrastDb: -60,
  themeGeneration: 1,
  index: 4,
};

describe("tileKey", () => {
  it("changes when any single input changes", () => {
    for (const field of Object.keys(BASE) as (keyof TileInputs)[]) {
      expect(tileKey({ ...BASE, [field]: CHANGED[field] })).not.toBe(tileKey(BASE));
    }
  });
});

describe("visibleTileRange", () => {
  it("covers the viewport", () => {
    expect(visibleTileRange(0, 600)).toEqual({ first: 0, last: 2 });
  });

  describe("edge cases", () => {
    it("clamps a negative scroll", () => {
      expect(visibleTileRange(-40, 100)).toEqual({ first: 0, last: 0 });
    });
  });
});
