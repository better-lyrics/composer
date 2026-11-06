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
    { text: "across ", begin: 12.902, end: 13.153 },
    { text: "the ", begin: 13.154, end: 13.48 },
    { text: "harbor", begin: 13.48, end: 14.2 },
    { text: "oh", begin: 14.2, end: 14.204 },
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
  it("marks only the given lines and keeps every word within 3 ms, ordered and never overlapping", () => {
    const [stamped, hand] = watermarkLines([ALIGNED, HAND], new Set(["a"]));
    expect(hand).toBe(HAND);
    const before = ALIGNED.words ?? [];
    const after = stamped.words ?? [];
    after.forEach((word, i) => {
      expect(Math.abs(word.begin - before[i].begin)).toBeLessThanOrEqual(3 * MS);
      expect(Math.abs(word.end - before[i].end)).toBeLessThanOrEqual(3 * MS);
      expect(word.begin).toBeLessThan(word.end);
      if (i === 0) return;
      if (before[i].begin === before[i - 1].end) expect(word.begin).toBe(after[i - 1].end);
      else expect(word.begin).toBeGreaterThanOrEqual(after[i - 1].end);
    });
    expect(readWatermark(ttmlOf([stamped, HAND]))).toEqual({ markedLines: 1, checkedLines: 2 });
  });

  it("never moves a line start, so lines that touch the line before still touch it", () => {
    const next = createLine({
      id: "b",
      text: "Home before the tide",
      words: [
        { text: "Home ", begin: 14.204, end: 14.6 },
        { text: "before ", begin: 14.6, end: 14.95 },
        { text: "the ", begin: 14.95, end: 15.2 },
        { text: "tide", begin: 15.2, end: 15.9 },
      ],
    });
    const stamped = watermarkLines([ALIGNED, next], new Set(["a", "b"]));
    expect(stamped.map((line) => line.words?.[0].begin)).toEqual([12.34, 14.204]);
    expect(readWatermark(ttmlOf(stamped)).markedLines).toBe(2);
  });
});
