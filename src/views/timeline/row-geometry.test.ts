import { describe, expect, it } from "vitest";
import { createLine, createWord } from "@/test/factories";
import {
  BG_DROP_ZONE_HEIGHT,
  BG_LANE_HEIGHT,
  bgTrackHeight,
  emptyBgRowHeight,
  lineRowHeight,
} from "@/views/timeline/row-geometry";

const withBg = () => createLine({ backgroundWords: [createWord({ text: "ooh", begin: 0, end: 1 })] });

// The background lane is a fixed slim lane under the main track (2.0 design); it no longer follows row resizes.
describe("bgTrackHeight", () => {
  it("uses the drop zone height for a line without background words", () => {
    expect(bgTrackHeight(createLine())).toBe(BG_DROP_ZONE_HEIGHT);
  });

  it("uses the background lane height for a line with background words", () => {
    expect(bgTrackHeight(withBg())).toBe(BG_LANE_HEIGHT);
  });

  describe("edge cases", () => {
    it("treats an empty background words array as no background words", () => {
      expect(bgTrackHeight(createLine({ backgroundWords: [] }))).toBe(BG_DROP_ZONE_HEIGHT);
    });
  });
});

describe("lineRowHeight", () => {
  it("adds main, background track and the 1px row border", () => {
    expect(lineRowHeight(createLine(), 44)).toBe(44 + BG_DROP_ZONE_HEIGHT + 1);
    expect(lineRowHeight(withBg(), 60)).toBe(60 + BG_LANE_HEIGHT + 1);
  });

  describe("invariants", () => {
    it("matches emptyBgRowHeight for a line without background words", () => {
      for (const main of [32, 44, 120]) expect(lineRowHeight(createLine(), main)).toBe(emptyBgRowHeight(main));
    });

    it("always equals main height plus bgTrackHeight plus one", () => {
      for (const line of [createLine(), withBg()]) {
        for (const main of [32, 44, 60, 80, 120]) {
          expect(lineRowHeight(line, main)).toBe(main + bgTrackHeight(line) + 1);
        }
      }
    });
  });
});
