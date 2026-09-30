import { describe, expect, it } from "vitest";
import type { WordTiming } from "@/domain/word/timing";
import { reorderWordTrack } from "@/domain/word/reorder-track";

const track: WordTiming[] = [
  { text: "one ", begin: 10, end: 11 },
  { text: "two ", begin: 12, end: 13 },
  { text: "three", begin: 13, end: 14 },
];

describe("reorderWordTrack with a time range", () => {
  it("stops a dragged word at the range start", () => {
    const result = reorderWordTrack(track, new Set([0]), -9, { min: 7, max: 20 });
    expect(result[0]).toMatchObject({ begin: 7, end: 8 });
  });

  it("stops a dragged word at the range end", () => {
    const result = reorderWordTrack(track, new Set([2]), 9, { min: 0, max: 15 });
    expect(result[result.length - 1]).toMatchObject({ begin: 14, end: 15 });
  });

  it("pushes an overlapped word back inside the range end", () => {
    const result = reorderWordTrack(track, new Set([1]), 1.5, { min: 0, max: 14.2 });
    expect(Math.max(...result.map((w) => w.end))).toBeLessThanOrEqual(14.2);
  });

  describe("regressions", () => {
    it("regression: the whole song range keeps the old zero floor and song end", () => {
      expect(reorderWordTrack(track, new Set([0]), -20, { min: 0, max: 20 })[0]).toMatchObject({ begin: 0, end: 1 });
      const last = reorderWordTrack(track, new Set([2]), 20, { min: 0, max: 20 }).at(-1);
      expect(last).toMatchObject({ begin: 19, end: 20 });
    });
  });
});
