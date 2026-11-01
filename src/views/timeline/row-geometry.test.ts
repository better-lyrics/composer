import { describe, expect, it } from "vitest";
import { createLine, createWord } from "@/test/factories";
import { BG_DROP_ZONE_HEIGHT, bgTrackHeight, emptyBgRowHeight, lineRowHeight } from "@/views/timeline/row-geometry";

const withBg = () => createLine({ backgroundWords: [createWord({ text: "ooh", begin: 0, end: 1 })] });

describe("bgTrackHeight", () => {
  it("uses the drop zone height for a line without background words", () => {
    expect(bgTrackHeight(createLine(), 44)).toBe(BG_DROP_ZONE_HEIGHT);
  });

  it("matches the main track height for a line with background words", () => {
    expect(bgTrackHeight(withBg(), 44)).toBe(44);
  });

  describe("edge cases", () => {
    it("follows a resized main track for a line with background words", () => {
      expect(bgTrackHeight(withBg(), 80)).toBe(80);
    });

    it("keeps the drop zone height for a resized line without background words", () => {
      expect(bgTrackHeight(createLine(), 80)).toBe(BG_DROP_ZONE_HEIGHT);
    });

    it("treats an empty background words array as no background words", () => {
      expect(bgTrackHeight(createLine({ backgroundWords: [] }), 60)).toBe(BG_DROP_ZONE_HEIGHT);
    });
  });
});

describe("lineRowHeight", () => {
  it("adds main, background track and the 1px row border", () => {
    expect(lineRowHeight(createLine(), 44)).toBe(44 + BG_DROP_ZONE_HEIGHT + 1);
    expect(lineRowHeight(withBg(), 60)).toBe(60 + 60 + 1);
  });

  describe("invariants", () => {
    it("matches emptyBgRowHeight for a line without background words", () => {
      for (const main of [32, 44, 120]) expect(lineRowHeight(createLine(), main)).toBe(emptyBgRowHeight(main));
    });

    it("always equals main height plus bgTrackHeight plus one", () => {
      for (const line of [createLine(), withBg()]) {
        for (const main of [32, 44, 60, 80, 120]) {
          expect(lineRowHeight(line, main)).toBe(main + bgTrackHeight(line, main) + 1);
        }
      }
    });
  });
});
