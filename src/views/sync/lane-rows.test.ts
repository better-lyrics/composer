import { createLine } from "@/test/factories";
import { buildLaneRows } from "@/views/sync/lane-rows";
import { describe, expect, it } from "vitest";

const rowFor = (text: string) => {
  const line = createLine({ id: "l0", text });
  return buildLaneRows({ lines: [line], displayLines: [line], agents: [], groupTags: new Map(), folded: new Set() })[0];
};

describe("buildLaneRows word runs", () => {
  it("regression: keeps the syllables of a split word in one run", () => {
    expect(rowFor("So I'm put|ting down").wordRuns).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 1 },
      { start: 2, end: 3 },
      { start: 4, end: 4 },
    ]);
  });

  describe("edge cases", () => {
    it("joins three syllables at the end of a line", () => {
      expect(rowFor("Hold ev|er|y").wordRuns).toEqual([
        { start: 0, end: 0 },
        { start: 1, end: 3 },
      ]);
    });

    it("gives an empty line no runs", () => {
      expect(rowFor("").wordRuns).toEqual([]);
    });
  });

  describe("invariants", () => {
    it("covers every word slot exactly once, in order", () => {
      const row = rowFor("Danc|ing in the kitch|en light");
      const covered = row.wordRuns.flatMap(({ start, end }) =>
        Array.from({ length: end - start + 1 }, (_, i) => start + i),
      );
      expect(covered).toEqual(row.wordTexts.map((_, index) => index));
    });
  });
});
