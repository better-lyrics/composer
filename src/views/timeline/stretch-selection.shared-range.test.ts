import { describe, expect, it } from "vitest";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LyricLine } from "@/domain/line/model";
import { createGroup, createLine, createWord } from "@/test/factories";
import { planStretchDrag } from "@/views/timeline/stretch-drag";
import { stretchSelections } from "@/views/timeline/stretch-selection";

// -- Fixtures -----------------------------------------------------------------

const DURATION = 20;
const MIN_WORD_DURATION = 0.1;
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

const word = (lineId: string, wordIndex: number) => ({ lineId, type: "word" as const, wordIndex });

// -- Tests --------------------------------------------------------------------

describe("stretchSelections with a shared time range", () => {
  const lines = [wordChorus("c0", 0, 3), wordChorus("c1", 1, 10), wordChorus("c2", 2, 16)];
  const rangeOf = timeRangeResolver(lines, sharing, DURATION);

  it("stops growth where the latest instance reaches the song end", () => {
    const result = stretchSelections(lines, [word("c1", 0), word("c1", 1)], 10, {
      rangeOf,
      minWordDuration: MIN_WORD_DURATION,
    });
    expect(result.appliedFactor).toBeCloseTo((14 - 10) / 2);
  });

  it("stops a left-edge drag where the earliest instance reaches zero", () => {
    const plan = planStretchDrag(
      lines,
      [word("c1", 0), word("c1", 1)],
      { lineId: "c1", type: "word", wordIndex: 0, edge: "left" },
      { rangeOf, minWordDuration: MIN_WORD_DURATION },
    );
    expect(plan?.maxFactor).toBeCloseTo((12 - 7) / 2);
  });

  it("stops a line-synced row where the latest instance reaches the song end", () => {
    const rows = [lineChorus("c0", 0, 3), lineChorus("c1", 1, 10), lineChorus("c2", 2, 16)];
    const outside = createLine({
      id: "x",
      text: "a b",
      words: [createWord({ text: "a ", begin: 9, end: 9.5 }), createWord({ text: "b", begin: 9.5, end: 10 })],
    });
    const all = [...rows, outside];
    const result = stretchSelections(all, [word("x", 0), word("x", 1), word("c1", 0)], 10, {
      rangeOf: timeRangeResolver(all, sharing, DURATION),
      minWordDuration: MIN_WORD_DURATION,
    });
    expect(result.appliedFactor).toBeCloseTo((14 - 9) / (12 - 9));
  });

  describe("regressions", () => {
    it("regression: a line of an old group still grows to the song end", () => {
      const result = stretchSelections(lines, [word("c1", 0), word("c1", 1)], 10, {
        rangeOf: timeRangeResolver(lines, oldGroup, DURATION),
        minWordDuration: MIN_WORD_DURATION,
      });
      expect(result.appliedFactor).toBeCloseTo((DURATION - 10) / 2);
    });
  });

  describe("edge cases", () => {
    it("is a no-op when the range end is not finite", () => {
      const result = stretchSelections(lines, [word("c1", 0), word("c1", 1)], 2, {
        rangeOf: timeRangeResolver(lines, sharing, Number.NaN),
        minWordDuration: MIN_WORD_DURATION,
      });
      expect(result.updates).toEqual([]);
    });

    it("keeps a shrink from moving a shared row before the range start", () => {
      const outside = createLine({
        id: "x",
        text: "a b",
        words: [createWord({ text: "a ", begin: 1, end: 2 }), createWord({ text: "b", begin: 2, end: 3 })],
      });
      const rows = [outside, lineChorus("c0", 0, 3), lineChorus("c1", 1, 10)];
      const result = stretchSelections(rows, [word("x", 0), word("x", 1), word("c1", 0)], 0.1, {
        rangeOf: timeRangeResolver(rows, sharing, DURATION),
        minWordDuration: MIN_WORD_DURATION,
      });
      expect(result.appliedFactor).toBeCloseTo((7 - 1) / (10 - 1));
    });
  });
});
