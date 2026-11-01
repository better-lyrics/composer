import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import { foldedLineIds } from "@/domain/sync/folded-lines";
import { createGroup, createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

const chorus = (instanceIdx: number, templateLineIdx: number, begin?: number) =>
  createLine({
    id: `c${instanceIdx}-${templateLineIdx}`,
    text: "I want",
    groupId: "g1",
    instanceIdx,
    templateLineIdx,
    ...(begin === undefined
      ? {}
      : {
          words: [
            { text: "I ", begin, end: begin + 0.4 },
            { text: "want", begin: begin + 0.5, end: begin + 1 },
          ],
        }),
  });

const verse = (id: string) => createLine({ id, text: "Walking home" });
const sharing = [createGroup({ id: "g1", sharesTiming: true })];
const song = (secondBegin?: number, thirdBegin?: number) => [
  chorus(0, 0, 10),
  chorus(0, 1, 11),
  verse("v1"),
  chorus(1, 0, secondBegin),
  chorus(1, 1, secondBegin === undefined ? undefined : secondBegin + 1),
  verse("v2"),
  chorus(2, 0, thirdBegin),
  chorus(2, 1, thirdBegin === undefined ? undefined : thirdBegin + 1),
];

const folded = (lines: LyricLine[], lineIndex: number, wordIndex = 0, groups: LinkGroup[] = sharing) =>
  [...foldedLineIds(lines, groups, { lineIndex, wordIndex })].toSorted();

describe("foldedLineIds", () => {
  it("folds every line after the first of an instance one tap places", () => {
    expect(folded(song(), 0, 1)).toEqual(["c1-1", "c2-1"]);
  });

  it("folds a placed shared instance too", () => {
    expect(folded(song(40), 5)).toEqual(["c1-1", "c2-1"]);
  });

  it("never folds the instance that holds the timing", () => {
    expect(folded(song(), 0, 1)).not.toContain("c0-1");
  });

  describe("edge cases", () => {
    it("folds nothing without a timed instance to copy from", () => {
      const lines = song().map((line) => (line.groupId ? { ...line, words: undefined } : line));
      expect(folded(lines, 0)).toEqual([]);
    });

    it("folds nothing for a group that does not share timing", () => {
      expect(folded(song(), 0, 1, [createGroup({ id: "g1" })])).toEqual([]);
    });

    it("folds nothing for an instance with its own timing", () => {
      const groups = [createGroup({ id: "g1", sharesTiming: true, ownTimingInstances: [1, 2] })];
      expect(folded(song(), 0, 1, groups)).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("keeps the instance open while the cursor re-records inside it", () => {
      expect(folded(song(40), 4)).toEqual(["c2-1"]);
      expect(folded(song(40), 3, 1)).toEqual(["c2-1"]);
    });

    it("keeps it folded while the cursor waits on its anchor", () => {
      expect(folded(song(40), 3, 0)).toContain("c1-1");
    });
  });
});
