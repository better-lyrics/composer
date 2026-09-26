import { describe, expect, it } from "vitest";
import {
  advanceCursor,
  isCursorPastEnd,
  nextSyncableLineIndex,
  previousSlot,
  prevSyncableLineIndex,
  resolveSyncCursor,
  slotBounds,
} from "@/domain/sync/cursor";
import { createLine } from "@/test/factories";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });
const blank = () => createLine({ text: "" });

describe("syncable line navigation", () => {
  const lines = [createLine({ text: "a" }), blank(), createLine({ text: "b" })];
  it("skips blank lines forward and backward", () => {
    expect(nextSyncableLineIndex(lines, 0)).toBe(2);
    expect(prevSyncableLineIndex(lines, 2)).toBe(0);
  });
  it("from -1 returns the first syncable line, skipping leading blanks", () => {
    expect(nextSyncableLineIndex([blank(), blank(), createLine({ text: "a" })], -1)).toBe(2);
    expect(nextSyncableLineIndex(lines, -1)).toBe(0);
  });
  it("returns lines.length and -1 at the ends", () => {
    expect(nextSyncableLineIndex(lines, 2)).toBe(3);
    expect(prevSyncableLineIndex(lines, 0)).toBe(-1);
  });
});

describe("advanceCursor", () => {
  const lines = [createLine({ text: "a b" }), blank(), createLine({ text: "c" })];
  it("moves to the next word in the same line", () => {
    expect(advanceCursor(lines, { lineIndex: 0, wordIndex: 0 }, "word")).toEqual({ lineIndex: 0, wordIndex: 1 });
  });
  it("moves past blank lines to the next syncable line after the last word", () => {
    expect(advanceCursor(lines, { lineIndex: 0, wordIndex: 1 }, "word")).toEqual({ lineIndex: 2, wordIndex: 0 });
  });
  it("line granularity always moves to the next syncable line", () => {
    expect(advanceCursor(lines, { lineIndex: 0, wordIndex: 0 }, "line")).toEqual({ lineIndex: 2, wordIndex: 0 });
  });
  it("moves past the end after the last line", () => {
    expect(advanceCursor(lines, { lineIndex: 2, wordIndex: 0 }, "word")).toEqual({ lineIndex: 3, wordIndex: 0 });
  });
});

describe("resolveSyncCursor", () => {
  it("regression D2: pulls the cursor back to the word undo removed", () => {
    const lines = [createLine({ text: "I heard the rumors", words: [word("I ", 1, 2), word("heard ", 2, 3)] })];
    expect(resolveSyncCursor(lines, { lineIndex: 0, wordIndex: 3 }, false, "word")).toEqual({
      lineIndex: 0,
      wordIndex: 2,
    });
  });
  it("regression U3: walks back across a line boundary to a partially timed line", () => {
    const lines = [createLine({ text: "a b c", words: [word("a ", 1, 2), word("b ", 2, 3)] })];
    expect(resolveSyncCursor(lines, { lineIndex: 1, wordIndex: 0 }, false, "word")).toEqual({
      lineIndex: 0,
      wordIndex: 2,
    });
  });
  it("walks back over several untimed lines after repeated undo", () => {
    const lines = [
      createLine({ text: "a", words: [word("a", 1, 2)] }),
      createLine({ text: "b" }),
      createLine({ text: "c" }),
    ];
    expect(resolveSyncCursor(lines, { lineIndex: 3, wordIndex: 0 }, false, "word")).toEqual({
      lineIndex: 1,
      wordIndex: 0,
    });
  });
  it("stops at a line-synced previous line at word granularity", () => {
    const lines = [createLine({ text: "a b", begin: 1, end: 2 }), createLine({ text: "c" })];
    expect(resolveSyncCursor(lines, { lineIndex: 1, wordIndex: 0 }, false, "word")).toEqual({
      lineIndex: 1,
      wordIndex: 0,
    });
  });
  it("line granularity walks back over untimed lines", () => {
    const lines = [createLine({ text: "a", begin: 1, end: 2 }), createLine({ text: "b" }), createLine({ text: "c" })];
    expect(resolveSyncCursor(lines, { lineIndex: 3, wordIndex: 0 }, false, "line")).toEqual({
      lineIndex: 1,
      wordIndex: 0,
    });
  });
  it("a jumped cursor is only clamped, never walked back", () => {
    const lines = [createLine({ text: "a" }), createLine({ text: "b c", words: [word("b ", 1, 2)] })];
    expect(resolveSyncCursor(lines, { lineIndex: 1, wordIndex: 0 }, true, "word")).toEqual({
      lineIndex: 1,
      wordIndex: 0,
    });
    expect(resolveSyncCursor(lines, { lineIndex: 1, wordIndex: 5 }, true, "word")).toEqual({
      lineIndex: 1,
      wordIndex: 1,
    });
  });
  it("moves off a line that is no longer syncable", () => {
    const lines = [createLine({ text: "a", words: [word("a", 1, 2)] }), blank(), createLine({ text: "c" })];
    expect(resolveSyncCursor(lines, { lineIndex: 1, wordIndex: 0 }, true, "word")).toEqual({
      lineIndex: 2,
      wordIndex: 0,
    });
  });
  it("clamps a line index beyond the end after lines were deleted", () => {
    const lines = [createLine({ text: "a", words: [word("a", 1, 2)] })];
    expect(resolveSyncCursor(lines, { lineIndex: 9, wordIndex: 0 }, false, "word")).toEqual({
      lineIndex: 1,
      wordIndex: 0,
    });
  });
  it("invariant: a fully consistent cursor is returned unchanged", () => {
    const lines = [createLine({ text: "a b", words: [word("a ", 1, 2)] })];
    expect(resolveSyncCursor(lines, { lineIndex: 0, wordIndex: 1 }, false, "word")).toEqual({
      lineIndex: 0,
      wordIndex: 1,
    });
  });
  it("edge: no lines resolves to the origin", () => {
    expect(resolveSyncCursor([], { lineIndex: 3, wordIndex: 2 }, false, "word")).toEqual({
      lineIndex: 0,
      wordIndex: 0,
    });
  });
});

describe("previousSlot and slotBounds", () => {
  const lines = [
    createLine({ text: "a b", words: [word("a ", 1, 2), word("b", 2, 3)] }),
    blank(),
    createLine({ text: "c", begin: 4, end: 5 }),
    createLine({ text: "d e", words: [word("d ", 6, 7)] }),
  ];
  it("regression T4: is the word just before the cursor, not the last timed word of the song", () => {
    expect(previousSlot(lines, { lineIndex: 0, wordIndex: 1 }, "word")).toEqual({ lineIndex: 0, wordIndex: 0 });
  });
  it("crosses blank lines to the last word of the previous syncable line", () => {
    expect(previousSlot(lines, { lineIndex: 2, wordIndex: 0 }, "word")).toEqual({ lineIndex: 0, wordIndex: 1 });
  });
  it("a line-synced previous line is one slot", () => {
    expect(previousSlot(lines, { lineIndex: 3, wordIndex: 0 }, "word")).toEqual({ lineIndex: 2, wordIndex: null });
  });
  it("line granularity treats a word-synced line as one slot", () => {
    expect(previousSlot(lines, { lineIndex: 2, wordIndex: 0 }, "line")).toEqual({ lineIndex: 0, wordIndex: null });
  });
  it("is null at the start and before an untimed line", () => {
    expect(previousSlot(lines, { lineIndex: 0, wordIndex: 0 }, "word")).toBeNull();
    const untimed = [createLine({ text: "a" }), createLine({ text: "b" })];
    expect(previousSlot(untimed, { lineIndex: 1, wordIndex: 0 }, "word")).toBeNull();
  });
  it("past the end, the previous slot is the last timed word", () => {
    expect(previousSlot(lines, { lineIndex: 4, wordIndex: 0 }, "word")).toEqual({ lineIndex: 3, wordIndex: 0 });
  });
  it("slotBounds reads a word, a line slot, and returns null for no timing", () => {
    expect(slotBounds(lines, { lineIndex: 0, wordIndex: 1 })).toEqual({ begin: 2, end: 3 });
    expect(slotBounds(lines, { lineIndex: 0, wordIndex: null })).toEqual({ begin: 1, end: 3 });
    expect(slotBounds(lines, { lineIndex: 2, wordIndex: null })).toEqual({ begin: 4, end: 5 });
    expect(slotBounds(lines, { lineIndex: 1, wordIndex: null })).toBeNull();
  });
});

describe("isCursorPastEnd", () => {
  it("is true only past the last line of a non-empty song", () => {
    const lines = [createLine({ text: "a" })];
    expect(isCursorPastEnd(lines, { lineIndex: 1, wordIndex: 0 })).toBe(true);
    expect(isCursorPastEnd(lines, { lineIndex: 0, wordIndex: 0 })).toBe(false);
    expect(isCursorPastEnd([], { lineIndex: 0, wordIndex: 0 })).toBe(false);
  });
});
