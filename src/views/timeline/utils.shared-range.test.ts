import { describe, expect, it } from "vitest";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { createGroup, createLine, createWord } from "@/test/factories";
import {
  nudgeSelectedWords,
  partitionNudgeSelections,
  shiftLineSyncedRows,
  shiftSelectionsTogether,
} from "@/views/timeline/utils";

// -- Fixtures -----------------------------------------------------------------

const DURATION = 20;
const sharing = [createGroup({ id: "g1", sharesTiming: true })];
const oldGroup = [createGroup({ id: "g1" })];

function wordChorus(id: string, instanceIdx: number, begin: number): LyricLine {
  return createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });
}

function lineChorus(id: string, instanceIdx: number, begin: number): LyricLine {
  return createLine({ id, text: "go now", groupId: "g1", instanceIdx, templateLineIdx: 0, begin, end: begin + 2 });
}

const wholeLine = (lineId: string): WordSelection[] => [
  { lineId, lineIndex: 0, wordIndex: 0, type: "word" },
  { lineId, lineIndex: 0, wordIndex: 1, type: "word" },
];
const lineRow = (lineId: string): WordSelection[] => [{ lineId, lineIndex: 0, wordIndex: 0, type: "word" }];

// -- Tests --------------------------------------------------------------------

describe("nudgeSelectedWords with a shared time range", () => {
  const lines = [wordChorus("c0", 0, 3), wordChorus("c1", 1, 10), wordChorus("c2", 2, 16)];
  const rangeOf = timeRangeResolver(lines, sharing, DURATION);

  it("stops a left nudge where the earliest instance reaches zero", () => {
    expect(nudgeSelectedWords(lines, wholeLine("c1"), -5, rangeOf).appliedDelta).toBe(-3);
  });

  it("stops a right nudge where the latest instance reaches the song end", () => {
    expect(nudgeSelectedWords(lines, wholeLine("c1"), 5, rangeOf).appliedDelta).toBe(2);
  });

  describe("regressions", () => {
    it("regression: a line of an old group still moves to zero and the song end", () => {
      const rangeOfOld = timeRangeResolver(lines, oldGroup, DURATION);
      expect(nudgeSelectedWords(lines, wholeLine("c1"), -15, rangeOfOld).appliedDelta).toBe(-10);
      expect(nudgeSelectedWords(lines, wholeLine("c1"), 15, rangeOfOld).appliedDelta).toBe(8);
    });
  });

  describe("edge cases", () => {
    it("keeps an unselected neighbour word as the limit inside the range", () => {
      const firstOnly = [{ lineId: "c1", lineIndex: 0, wordIndex: 0, type: "word" as const }];
      expect(nudgeSelectedWords(lines, firstOnly, 5, rangeOf).appliedDelta).toBe(0);
    });
  });
});

describe("shiftLineSyncedRows with a shared time range", () => {
  const lines = [lineChorus("c0", 0, 3), lineChorus("c1", 1, 10), lineChorus("c2", 2, 16)];
  const rangeOf = timeRangeResolver(lines, sharing, DURATION);

  it("stops a left shift where the earliest instance reaches zero", () => {
    expect(shiftLineSyncedRows(lines, lineRow("c1"), -5, rangeOf).appliedDelta).toBe(-3);
  });

  it("stops a right shift where the latest instance reaches the song end", () => {
    expect(shiftLineSyncedRows(lines, lineRow("c1"), 5, rangeOf).appliedDelta).toBe(2);
  });

  describe("regressions", () => {
    it("regression: a line of an old group still moves to zero and the song end", () => {
      const rangeOfOld = timeRangeResolver(lines, oldGroup, DURATION);
      expect(shiftLineSyncedRows(lines, lineRow("c1"), -15, rangeOfOld).appliedDelta).toBe(-10);
      expect(shiftLineSyncedRows(lines, lineRow("c1"), 15, rangeOfOld).appliedDelta).toBe(8);
    });
  });
});

describe("shiftSelectionsTogether with a shared time range", () => {
  it("moves a shared row and an outside row together by the smaller room", () => {
    const outside = createLine({ id: "x", text: "verse", begin: 5, end: 6 });
    const lines = [lineChorus("c0", 0, 3), outside, lineChorus("c1", 1, 10)];
    const selection = [...lineRow("x"), ...lineRow("c1")];
    const rangeOf = timeRangeResolver(lines, sharing, DURATION);

    const result = shiftSelectionsTogether(lines, partitionNudgeSelections(lines, selection), -4, rangeOf);

    expect(result.appliedDelta).toBe(-3);
  });

  describe("invariants", () => {
    it("never moves a placed shared copy below zero or past the song end", () => {
      const lines = [wordChorus("c0", 0, 3), wordChorus("c1", 1, 10), wordChorus("c2", 2, 16)];
      const rangeOf = timeRangeResolver(lines, sharing, DURATION);
      for (const delta of [-50, -3.5, -0.1, 0.1, 2.5, 50]) {
        const { appliedDelta } = shiftSelectionsTogether(
          lines,
          partitionNudgeSelections(lines, wholeLine("c1")),
          delta,
          rangeOf,
        );
        for (const offset of [3 - 10, 0, 16 - 10]) {
          expect(10 + appliedDelta + offset).toBeGreaterThanOrEqual(0);
          expect(12 + appliedDelta + offset).toBeLessThanOrEqual(DURATION);
        }
      }
    });
  });
});
