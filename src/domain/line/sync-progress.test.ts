import { describe, expect, it } from "vitest";
import {
  isLineFullyTimed,
  isLineTimed,
  isSyncableLine,
  isSyncComplete,
  syncProgress,
  wordSlotCount,
} from "@/domain/line/sync-progress";
import { createLine } from "@/test/factories";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });

describe("isSyncableLine", () => {
  it("is true for a line with main lyrics", () => {
    expect(isSyncableLine(createLine({ text: "hello" }))).toBe(true);
  });
  it("is false for a blank line, whitespace, and undefined", () => {
    expect(isSyncableLine(createLine({ text: "" }))).toBe(false);
    expect(isSyncableLine(createLine({ text: "   " }))).toBe(false);
    expect(isSyncableLine(undefined)).toBe(false);
  });
});

describe("isLineTimed", () => {
  it("is true for word-synced and line-synced lines", () => {
    expect(isLineTimed(createLine({ text: "a", words: [word("a", 1, 2)] }))).toBe(true);
    expect(isLineTimed(createLine({ text: "a", begin: 1, end: 2 }))).toBe(true);
  });
  it("is false for an untimed line", () => {
    expect(isLineTimed(createLine({ text: "a" }))).toBe(false);
  });
  it("regression: a line-synced line beginning at 0 is timed", () => {
    expect(isLineTimed(createLine({ text: "a", begin: 0, end: 1 }))).toBe(true);
  });
});

describe("wordSlotCount and isLineFullyTimed", () => {
  it("counts syllables split by the split character as slots", () => {
    expect(wordSlotCount(createLine({ text: "hel|lo world" }))).toBe(3);
  });
  it("a word-synced line is fully timed only when every slot has a word", () => {
    expect(isLineFullyTimed(createLine({ text: "a b", words: [word("a ", 1, 2)] }))).toBe(false);
    expect(isLineFullyTimed(createLine({ text: "a b", words: [word("a ", 1, 2), word("b", 2, 3)] }))).toBe(true);
  });
  it("a line-synced line is fully timed", () => {
    expect(isLineFullyTimed(createLine({ text: "a b", begin: 1, end: 2 }))).toBe(true);
  });
  it("an untimed line and a blank line are not fully timed", () => {
    expect(isLineFullyTimed(createLine({ text: "a b" }))).toBe(false);
    expect(isLineFullyTimed(createLine({ text: "" }))).toBe(false);
  });
});

describe("syncProgress", () => {
  const lines = [
    createLine({ text: "a b", words: [word("a ", 1, 2)] }),
    createLine({ text: "" }),
    createLine({ text: "c", begin: 3, end: 4 }),
    createLine({ text: "d e" }),
  ];
  it("line granularity counts only syncable lines (regression U2: blank lines are not in the denominator)", () => {
    expect(syncProgress(lines, "line")).toEqual({ done: 2, total: 3 });
  });
  it("word granularity counts word slots and timed words", () => {
    expect(syncProgress(lines, "word")).toEqual({ done: 1, total: 5 });
  });
  it("is zero over zero for no lines", () => {
    expect(syncProgress([], "line")).toEqual({ done: 0, total: 0 });
    expect(syncProgress([], "word")).toEqual({ done: 0, total: 0 });
  });
  it("invariant: done never exceeds total even if words outnumber slots", () => {
    const over = [createLine({ text: "a", words: [word("a", 1, 2), word("b", 2, 3)] })];
    expect(syncProgress(over, "word")).toEqual({ done: 1, total: 1 });
  });
});

describe("isSyncComplete", () => {
  it("is true only when every syncable line is fully timed", () => {
    const done = [createLine({ text: "a", words: [word("a", 1, 2)] }), createLine({ text: "" })];
    expect(isSyncComplete(done)).toBe(true);
  });
  it("regression U3: a partially timed line means the sync is not complete", () => {
    expect(isSyncComplete([createLine({ text: "a b c", words: [word("a ", 1, 2), word("b ", 2, 3)] })])).toBe(false);
  });
  it("is false with no syncable lines", () => {
    expect(isSyncComplete([])).toBe(false);
    expect(isSyncComplete([createLine({ text: "" })])).toBe(false);
  });
});
