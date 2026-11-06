import { describe, expect, it } from "vitest";
import { readWatermark, watermarkLines } from "@/domain/alignment/watermark";
import type { LyricLine } from "@/domain/line/model";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { createLine } from "@/test/factories";
import { generateTTML } from "@/utils/ttml";

// -- Fixtures -----------------------------------------------------------------

const ALIGNED = createLine({
  id: "a",
  text: "Lanterns drift across the harbor",
  words: [
    { text: "Lanterns ", begin: 12.34, end: 12.611 },
    { text: "drift ", begin: 12.611, end: 12.902 },
    { text: "across ", begin: 12.902, end: 13.155 },
    { text: "the ", begin: 13.155, end: 13.48 },
    { text: "harbor", begin: 13.48, end: 14.2 },
  ],
});

const HAND = createLine({
  id: "h",
  text: "Salt on the evening wind",
  words: [
    { text: "Salt ", begin: 15.012, end: 15.4 },
    { text: "on ", begin: 15.4, end: 15.61 },
    { text: "the ", begin: 15.61, end: 15.8 },
    { text: "evening ", begin: 15.8, end: 16.33 },
    { text: "wind", begin: 16.33, end: 17.1 },
  ],
});

const MS = 0.001 + 1e-9;

function ttmlOf(lines: LyricLine[]): string {
  return generateTTML({ metadata: normalizeLoadedMetadata(null), agents: [], lines });
}

// -- Tests --------------------------------------------------------------------

describe("watermarkLines", () => {
  it("marks only the given lines and keeps every word within 3 ms, ordered and touching", () => {
    const [stamped, hand] = watermarkLines([ALIGNED, HAND], new Set(["a"]));
    expect(hand).toBe(HAND);
    const before = ALIGNED.words ?? [];
    const after = stamped.words ?? [];
    after.forEach((word, i) => {
      expect(Math.abs(word.begin - before[i].begin)).toBeLessThanOrEqual(3 * MS);
      expect(Math.abs(word.end - before[i].end)).toBeLessThanOrEqual(3 * MS);
      expect(word.begin).toBeLessThan(word.end);
      if (i > 0) expect(word.begin).toBe(after[i - 1].end);
    });
    expect(readWatermark(ttmlOf([stamped, HAND]))).toEqual({ markedLines: 1, checkedLines: 2 });
  });
});
