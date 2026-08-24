import { describe, expect, it } from "vitest";
import { createLine } from "@/test/factories";
import type { WordSelection } from "@/domain/selection/model";
import {
  findBoundaryTarget,
  findWordsAtTime,
  pickNextWordAtPlayhead,
  selectionForPlayhead,
} from "@/views/timeline/word-at-playhead";

describe("findWordsAtTime", () => {
  it("returns empty when nothing overlaps the time", () => {
    const lines = [createLine({ words: [{ text: "a", begin: 0, end: 1 }] })];
    expect(findWordsAtTime(lines, 5)).toEqual([]);
  });

  it("treats begin as inclusive and end as exclusive", () => {
    const lines = [createLine({ words: [{ text: "a", begin: 1, end: 2 }] })];
    expect(findWordsAtTime(lines, 1)).toHaveLength(1);
    expect(findWordsAtTime(lines, 2)).toEqual([]);
    expect(findWordsAtTime(lines, 1.999)).toHaveLength(1);
  });

  it("returns a main word and an overlapping background word, main first", () => {
    const line = createLine({
      id: "line-a",
      words: [{ text: "main", begin: 0, end: 2 }],
      backgroundWords: [{ text: "bg", begin: 0.5, end: 1.5 }],
    });
    const matches = findWordsAtTime([line], 1);
    expect(matches).toEqual<WordSelection[]>([
      { lineId: "line-a", lineIndex: 0, wordIndex: 0, type: "word" },
      { lineId: "line-a", lineIndex: 0, wordIndex: 0, type: "bg" },
    ]);
  });

  it("returns overlapping words from multiple lines in line order", () => {
    const lineOne = createLine({ id: "line-1", words: [{ text: "one", begin: 0, end: 3 }] });
    const lineTwo = createLine({ id: "line-2", words: [{ text: "two", begin: 1, end: 4 }] });
    const matches = findWordsAtTime([lineOne, lineTwo], 2);
    expect(matches).toEqual<WordSelection[]>([
      { lineId: "line-1", lineIndex: 0, wordIndex: 0, type: "word" },
      { lineId: "line-2", lineIndex: 1, wordIndex: 0, type: "word" },
    ]);
  });
});

describe("pickNextWordAtPlayhead", () => {
  const matchA: WordSelection = { lineId: "line-1", lineIndex: 0, wordIndex: 0, type: "word" };
  const matchB: WordSelection = { lineId: "line-1", lineIndex: 0, wordIndex: 0, type: "bg" };
  const matchC: WordSelection = { lineId: "line-2", lineIndex: 1, wordIndex: 0, type: "word" };

  it("returns null when matches are empty", () => {
    expect(pickNextWordAtPlayhead([], [matchA])).toBeNull();
  });

  it("returns the first match when nothing is selected", () => {
    expect(pickNextWordAtPlayhead([matchA, matchB], [])).toEqual(matchA);
  });

  it("advances to the next match when the current selection is one of the matches", () => {
    expect(pickNextWordAtPlayhead([matchA, matchB, matchC], [matchA])).toEqual(matchB);
  });

  it("wraps from the last match back to the first", () => {
    expect(pickNextWordAtPlayhead([matchA, matchB, matchC], [matchC])).toEqual(matchA);
  });

  it("falls back to the first match when more than one word is selected", () => {
    expect(pickNextWordAtPlayhead([matchA, matchB, matchC], [matchA, matchB])).toEqual(matchA);
  });

  it("falls back to the first match when the selection is not among the matches", () => {
    const outsider: WordSelection = { lineId: "line-9", lineIndex: 8, wordIndex: 3, type: "word" };
    expect(pickNextWordAtPlayhead([matchA, matchB, matchC], [outsider])).toEqual(matchA);
  });
});

describe("findBoundaryTarget", () => {
  const gappedLine = () =>
    createLine({
      id: "gapped",
      text: "done gave",
      words: [
        { text: "done ", begin: 1, end: 2 },
        { text: "gave", begin: 3, end: 4 },
      ],
    });

  it("prefers the word under the playhead over any neighbour, on both edges", () => {
    const lines = [gappedLine()];
    const inside = { lineId: "gapped", lineIndex: 0, wordIndex: 0, type: "word" as const };
    expect(findBoundaryTarget(lines, 1.5, "begin")).toEqual(inside);
    expect(findBoundaryTarget(lines, 1.5, "end")).toEqual(inside);
  });

  it("reaches forward to the word starting after the playhead on the begin edge", () => {
    expect(findBoundaryTarget([gappedLine()], 2.5, "begin")).toEqual({
      lineId: "gapped",
      lineIndex: 0,
      wordIndex: 1,
      type: "word",
    });
  });

  it("reaches back to the word ending before the playhead on the end edge", () => {
    expect(findBoundaryTarget([gappedLine()], 2.5, "end")).toEqual({
      lineId: "gapped",
      lineIndex: 0,
      wordIndex: 0,
      type: "word",
    });
  });

  it("picks the nearest word in time rather than the earliest line", () => {
    const far = createLine({ id: "far", words: [{ text: "far", begin: 9, end: 10 }] });
    const near = createLine({ id: "near", words: [{ text: "near", begin: 5, end: 6 }] });
    expect(findBoundaryTarget([far, near], 4, "begin")).toEqual({
      lineId: "near",
      lineIndex: 1,
      wordIndex: 0,
      type: "word",
    });
  });

  it("lets a background word win when it is the nearest across the gap", () => {
    const line = createLine({
      id: "mixed",
      text: "lead",
      words: [{ text: "lead", begin: 6, end: 7 }],
      backgroundText: "ooh",
      backgroundWords: [{ text: "ooh", begin: 5, end: 5.5 }],
    });
    expect(findBoundaryTarget([line], 4, "begin")).toEqual({
      lineId: "mixed",
      lineIndex: 0,
      wordIndex: 0,
      type: "bg",
    });
  });

  describe("edge cases", () => {
    it("returns null for an empty timeline on both edges", () => {
      expect(findBoundaryTarget([], 1, "begin")).toBeNull();
      expect(findBoundaryTarget([], 1, "end")).toBeNull();
    });

    it("ignores lines that carry no timed words", () => {
      const untimed = createLine({ id: "untimed", text: "no timing" });
      expect(findBoundaryTarget([untimed], 1, "begin")).toBeNull();
      expect(findBoundaryTarget([untimed], 1, "end")).toBeNull();
    });

    it("has nothing to pull back when the playhead sits past every word", () => {
      const lines = [gappedLine()];
      expect(findBoundaryTarget(lines, 8, "begin")).toBeNull();
      expect(findBoundaryTarget(lines, 8, "end")).toEqual({
        lineId: "gapped",
        lineIndex: 0,
        wordIndex: 1,
        type: "word",
      });
    });

    it("has nothing to push forward when the playhead sits before every word", () => {
      const lines = [gappedLine()];
      expect(findBoundaryTarget(lines, 0.5, "end")).toBeNull();
      expect(findBoundaryTarget(lines, 0.5, "begin")).toEqual({
        lineId: "gapped",
        lineIndex: 0,
        wordIndex: 0,
        type: "word",
      });
    });

    it("treats a playhead resting exactly on a word's end as outside that word", () => {
      const lines = [gappedLine()];
      expect(findBoundaryTarget(lines, 2, "end")).toEqual({
        lineId: "gapped",
        lineIndex: 0,
        wordIndex: 0,
        type: "word",
      });
      expect(findBoundaryTarget(lines, 2, "begin")).toEqual({
        lineId: "gapped",
        lineIndex: 0,
        wordIndex: 1,
        type: "word",
      });
    });

    it("keeps the begin edge on the word the playhead starts", () => {
      expect(findBoundaryTarget([gappedLine()], 3, "begin")).toEqual({
        lineId: "gapped",
        lineIndex: 0,
        wordIndex: 1,
        type: "word",
      });
    });

    it("sends the end edge back a word when the playhead rests on a word's begin", () => {
      expect(findBoundaryTarget([gappedLine()], 3, "end")).toEqual({
        lineId: "gapped",
        lineIndex: 0,
        wordIndex: 0,
        type: "word",
      });
    });

    it("hands each edge its own side of a flush seam", () => {
      const flush = createLine({
        id: "flush",
        text: "a b",
        words: [
          { text: "a ", begin: 1, end: 2 },
          { text: "b", begin: 2, end: 3 },
        ],
      });
      expect(findBoundaryTarget([flush], 2, "end")?.wordIndex).toBe(0);
      expect(findBoundaryTarget([flush], 2, "begin")?.wordIndex).toBe(1);
    });
  });

  describe("invariants", () => {
    it("breaks a tie on equal distance by scan order", () => {
      const first = createLine({ id: "first", words: [{ text: "a", begin: 3, end: 4 }] });
      const second = createLine({ id: "second", words: [{ text: "b", begin: 3, end: 4 }] });
      expect(findBoundaryTarget([first, second], 2, "begin")).toEqual({
        lineId: "first",
        lineIndex: 0,
        wordIndex: 0,
        type: "word",
      });
    });

    it("never reaches across a word that already lies between the playhead and the candidate", () => {
      const line = createLine({
        id: "three",
        text: "a b c",
        words: [
          { text: "a ", begin: 0, end: 1 },
          { text: "b ", begin: 2, end: 3 },
          { text: "c", begin: 4, end: 5 },
        ],
      });
      expect(findBoundaryTarget([line], 1.5, "begin")?.wordIndex).toBe(1);
      expect(findBoundaryTarget([line], 3.5, "end")?.wordIndex).toBe(1);
    });

    it("prefers a word spanning the playhead over one that merely ends on it", () => {
      const ending = createLine({ id: "ending", words: [{ text: "x", begin: 1, end: 2 }] });
      const spanning = createLine({ id: "spanning", words: [{ text: "y", begin: 1.5, end: 2.5 }] });
      expect(findBoundaryTarget([ending, spanning], 2, "end")).toEqual({
        lineId: "spanning",
        lineIndex: 1,
        wordIndex: 0,
        type: "word",
      });
    });

    it("leaves the input lines untouched", () => {
      const lines = [gappedLine()];
      const snapshot = structuredClone(lines);
      findBoundaryTarget(lines, 2.5, "begin");
      findBoundaryTarget(lines, 2.5, "end");
      expect(lines).toEqual(snapshot);
    });
  });
});

describe("selectionForPlayhead", () => {
  it("selects the containing word without flagging a gap reach", () => {
    const line = createLine({ id: "l1", words: [{ text: "a", begin: 1, end: 2 }] });
    expect(selectionForPlayhead([line], 1.5, [])).toEqual({
      selection: { lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" },
      fromGap: false,
    });
  });

  it("cycles through overlapping matches so main and background stay reachable", () => {
    const line = createLine({
      id: "l1",
      words: [{ text: "main", begin: 0, end: 2 }],
      backgroundWords: [{ text: "bg", begin: 0.5, end: 1.5 }],
    });
    const main: WordSelection = { lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" };
    expect(selectionForPlayhead([line], 1, [])?.selection).toEqual(main);
    expect(selectionForPlayhead([line], 1, [main])?.selection).toEqual<WordSelection>({ ...main, type: "bg" });
  });

  it("reaches the nearest word behind when the playhead sits just past it", () => {
    const line = createLine({
      id: "l1",
      words: [
        { text: "a", begin: 0, end: 1 },
        { text: "b", begin: 5, end: 6 },
      ],
    });
    expect(selectionForPlayhead([line], 1.2, [])).toEqual({
      selection: { lineId: "l1", lineIndex: 0, wordIndex: 0, type: "word" },
      fromGap: true,
    });
  });

  it("reaches the nearest word ahead when the playhead sits just before it", () => {
    const line = createLine({
      id: "l1",
      words: [
        { text: "a", begin: 0, end: 1 },
        { text: "b", begin: 5, end: 6 },
      ],
    });
    const result = selectionForPlayhead([line], 4.8, []);
    expect(result?.selection.wordIndex).toBe(1);
    expect(result?.fromGap).toBe(true);
  });

  it("reaches backwards without a distance limit when the playhead is far past every word", () => {
    const line = createLine({ id: "l1", words: [{ text: "a", begin: 0, end: 1 }] });
    const result = selectionForPlayhead([line], 900, []);
    expect(result?.selection.wordIndex).toBe(0);
    expect(result?.fromGap).toBe(true);
  });

  it("reaches a background word when it is the nearest thing to the playhead", () => {
    const line = createLine({
      id: "l1",
      words: [{ text: "main", begin: 0, end: 1 }],
      backgroundWords: [{ text: "bg", begin: 8, end: 9 }],
    });
    expect(selectionForPlayhead([line], 7.9, [])?.selection.type).toBe("bg");
  });

  describe("edge cases", () => {
    it("returns null when there are no lines at all", () => {
      expect(selectionForPlayhead([], 3, [])).toBeNull();
    });

    it("returns null when no line carries any timed words", () => {
      const line = createLine({ id: "l1", text: "untimed" });
      expect(selectionForPlayhead([line], 3, [])).toBeNull();
    });

    it("prefers the containing word over a closer-looking neighbour", () => {
      const line = createLine({
        id: "l1",
        words: [
          { text: "a", begin: 0, end: 10 },
          { text: "b", begin: 10.01, end: 11 },
        ],
      });
      const result = selectionForPlayhead([line], 9.999, []);
      expect(result?.selection.wordIndex).toBe(0);
      expect(result?.fromGap).toBe(false);
    });

    it("picks the earlier word when two are exactly equidistant", () => {
      const line = createLine({
        id: "l1",
        words: [
          { text: "a", begin: 0, end: 1 },
          { text: "b", begin: 3, end: 4 },
        ],
      });
      expect(selectionForPlayhead([line], 2, [])?.selection.wordIndex).toBe(0);
    });

    it("skips a word whose timings are not finite rather than ranking it as nearest", () => {
      const line = createLine({
        id: "l1",
        words: [
          { text: "good", begin: 1, end: 2 },
          { text: "broken", begin: Number.NaN, end: Number.NaN },
        ],
      });
      expect(selectionForPlayhead([line], 50, [])?.selection.wordIndex).toBe(0);
    });

    it("returns null when every word has non-finite timings", () => {
      const line = createLine({ id: "l1", words: [{ text: "broken", begin: Number.NaN, end: Number.NaN }] });
      expect(selectionForPlayhead([line], 50, [])).toBeNull();
    });

    it("treats the exclusive end of a word as a gap, not containment", () => {
      const line = createLine({ id: "l1", words: [{ text: "a", begin: 0, end: 1 }] });
      expect(selectionForPlayhead([line], 1, [])?.fromGap).toBe(true);
    });
  });

  describe("invariants", () => {
    it("always returns a selection when any timed word exists, for any playhead time", () => {
      const line = createLine({ id: "l1", words: [{ text: "a", begin: 4, end: 5 }] });
      for (const time of [0, 4, 4.5, 5, 1000]) {
        expect(selectionForPlayhead([line], time, [])).not.toBeNull();
      }
    });

    it("only ever flags fromGap when the playhead is outside every word", () => {
      const line = createLine({ id: "l1", words: [{ text: "a", begin: 4, end: 5 }] });
      expect(selectionForPlayhead([line], 4.5, [])?.fromGap).toBe(false);
      expect(selectionForPlayhead([line], 3, [])?.fromGap).toBe(true);
      expect(selectionForPlayhead([line], 9, [])?.fromGap).toBe(true);
    });
  });
});
