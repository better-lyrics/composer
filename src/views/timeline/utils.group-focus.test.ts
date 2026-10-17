import type { LyricLine } from "@/domain/line/model";
import { createLine, createWord } from "@/test/factories";
import { type RowLayout, computeRowLayout, getEffectiveRows } from "@/views/timeline/utils";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const chorusLine = (id: string, instanceIdx: number, templateLineIdx: number, begin: number) =>
  createLine({
    id,
    text: "go now",
    groupId: "g1",
    instanceIdx,
    templateLineIdx,
    words: [
      createWord({ text: "go ", begin, end: begin + 1 }),
      createWord({ text: "now", begin: begin + 1, end: begin + 2 }),
    ],
  });

const lines: LyricLine[] = [
  chorusLine("a0", 0, 0, 10),
  chorusLine("a1", 0, 1, 12),
  createLine({ id: "v", text: "verse", words: [createWord({ text: "verse", begin: 20, end: 21 })] }),
  chorusLine("b0", 1, 0, 40),
  chorusLine("b1", 1, 1, 42),
];

const focusOnSecond = { groupId: "g1", hearInstanceIdx: 1 };
const WAVEFORM = 80;
const HEADER = 38;
const ROW = 40;

function layoutFor(focusedGroup: typeof focusOnSecond | null, collapsedInstances: Record<string, boolean> = {}) {
  return computeRowLayout({
    lines,
    rowHeights: {},
    defaultRowHeight: ROW,
    collapsedInstances,
    focusedGroup,
    waveformHeight: WAVEFORM,
    groupHeaderHeight: HEADER,
  });
}

const layoutLineIds = (layout: RowLayout) => [...layout.lineTops.keys()];

// -- Tests --------------------------------------------------------------------

describe("getEffectiveRows · group focus", () => {
  it("keeps only the rows of the heard instance, without its header", () => {
    const rows = getEffectiveRows(lines, focusOnSecond);

    expect(rows.map((row) => (row.kind === "line" ? row.line.id : row.kind))).toEqual(["b0", "b1"]);
  });

  it("keeps the line index into the whole song", () => {
    const rows = getEffectiveRows(lines, focusOnSecond);

    expect(rows.map((row) => (row.kind === "line" ? row.lineIndex : -1))).toEqual([3, 4]);
  });

  it("shows every row with headers for a focus on a missing instance", () => {
    expect(getEffectiveRows(lines, { groupId: "g1", hearInstanceIdx: 9 })).toEqual(getEffectiveRows(lines));
  });

  it("shows every row with headers when nothing is focused", () => {
    expect(getEffectiveRows(lines, null)).toHaveLength(getEffectiveRows(lines).length);
    expect(getEffectiveRows(lines).filter((row) => row.kind === "group-header")).toHaveLength(2);
  });
});

describe("computeRowLayout · group focus", () => {
  it("lays out only the heard instance, starting under the waveform", () => {
    const layout = layoutFor(focusOnSecond);

    expect(layoutLineIds(layout)).toEqual(["b0", "b1"]);
    expect(layout.lineTops.get("b0")?.top).toBe(WAVEFORM);
    expect(layout.headerTops.size).toBe(0);
  });

  describe("edge cases", () => {
    it("shows the rows of a collapsed instance while it is focused", () => {
      expect(layoutLineIds(layoutFor(focusOnSecond, { "g1:1": true }))).toEqual(["b0", "b1"]);
    });

    it("lays out the whole song for a focus on a missing instance", () => {
      expect(layoutLineIds(layoutFor({ groupId: "g1", hearInstanceIdx: 9 }))).toEqual(layoutLineIds(layoutFor(null)));
      expect(layoutFor({ groupId: "g1", hearInstanceIdx: 9 }).headerTops.size).toBe(2);
    });
  });

  describe("invariants", () => {
    it("agrees with getEffectiveRows on which lines are shown", () => {
      for (const focus of [
        null,
        focusOnSecond,
        { groupId: "g1", hearInstanceIdx: 0 },
        { groupId: "g1", hearInstanceIdx: 9 },
      ]) {
        const rowIds = getEffectiveRows(lines, focus).flatMap((row) => (row.kind === "line" ? [row.line.id] : []));
        expect(layoutLineIds(layoutFor(focus))).toEqual(rowIds);
      }
    });
  });
});
