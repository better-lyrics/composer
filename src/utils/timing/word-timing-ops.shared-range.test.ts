import { describe, expect, it } from "vitest";
import { timeRangeResolver } from "@/domain/group/shared-timing";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { createGroup, createLine } from "@/test/factories";
import { nudgeBgWordBegin, nudgeBgWordEnd } from "@/utils/timing/bg-word-timing";
import { nudgeWordBegin, nudgeWordEnd, setWordBegin, setWordBoundary, setWordEnd } from "@/utils/timing/word-timing";

const word = (text: string, begin: number, end: number) => ({ text, begin, end });

function chorus(id: string, instanceIdx: number, begin: number): LyricLine {
  return createLine({
    id,
    text: "I want",
    groupId: "g1",
    instanceIdx,
    templateLineIdx: 0,
    words: [word("I ", begin, begin + 0.4), word("want", begin + 0.5, begin + 1)],
    backgroundText: "oh",
    backgroundWords: [word("oh", begin + 0.2, begin + 0.8)],
  });
}

function seed(sharesTiming: boolean): void {
  useProjectStore.setState({
    lines: [chorus("c0", 0, 3), chorus("c1", 1, 10)],
    groups: [createGroup({ id: "g1", ...(sharesTiming ? { sharesTiming: true } : {}) })],
  });
}

const store = () => useProjectStore.getState();
const lineById = (id: string) => store().lines.find((line) => line.id === id);

describe("word timing ops with a shared time range", () => {
  it("stops a first word nudge where the earliest instance reaches zero", () => {
    seed(true);

    nudgeWordBegin(store().lines, 1, 0, -5, store().updateLineWithHistory, store().groups);

    expect(lineById("c1")?.words?.[0].begin).toBe(7);
    expect(lineById("c0")?.words?.[0].begin).toBe(0);
  });

  it("stops a first word set before the range", () => {
    seed(true);

    setWordBegin(store().lines, 1, 0, 2, store().updateLineWithHistory, store().groups);

    expect(lineById("c1")?.words?.[0].begin).toBe(7);
    expect(lineById("c0")?.words?.[0].begin).toBe(0);
  });

  it("stops a first background word at the start of the range", () => {
    seed(true);

    nudgeBgWordBegin(store().lines, 1, 0, -5, store().updateLineWithHistory, store().groups);

    expect(lineById("c1")?.backgroundWords?.[0].begin).toBe(7);
    expect(lineById("c0")?.backgroundWords?.[0].begin).toBe(0);
  });

  describe("regressions", () => {
    it("moves a first word of an old group to zero, as before", () => {
      seed(false);

      nudgeWordBegin(store().lines, 1, 0, -15, store().updateLineWithHistory, store().groups);

      expect(lineById("c1")?.words?.[0].begin).toBe(0);
      expect(lineById("c0")?.words?.[0].begin).toBe(3);
    });

    it("keeps no end limit for a last word", () => {
      seed(true);

      nudgeWordEnd(store().lines, 1, 1, 100, store().updateLineWithHistory, store().groups);

      expect(lineById("c1")?.words?.[1].end).toBe(111);
      expect(lineById("c0")?.words?.[1].end).toBe(104);
    });
  });

  describe("edge cases", () => {
    it("is rejected by the store when no groups are given and a copy would go below zero", () => {
      seed(true);

      nudgeWordBegin(store().lines, 1, 0, -15, store().updateLineWithHistory);

      expect(lineById("c1")?.words?.[0].begin).toBe(10);
    });
  });
});

describe("word timing ops with a song end", () => {
  const SONG_END = 12;

  it("stops a last word end where the latest instance reaches the song end", () => {
    seed(true);

    nudgeWordEnd(store().lines, 0, 1, 100, store().updateLineWithHistory, store().groups, SONG_END);

    expect(lineById("c0")?.words?.[1].end).toBe(5);
    expect(lineById("c1")?.words?.[1].end).toBe(12);
  });

  it("stops a last word set past the range", () => {
    seed(true);

    setWordEnd(store().lines, 0, 1, 100, store().updateLineWithHistory, store().groups, SONG_END);

    expect(lineById("c0")?.words?.[1].end).toBe(5);
    expect(lineById("c1")?.words?.[1].end).toBe(12);
  });

  it("stops a last background word end where the latest instance reaches the song end", () => {
    seed(true);

    nudgeBgWordEnd(store().lines, 0, 0, 100, store().updateLineWithHistory, store().groups, SONG_END);

    expect(lineById("c0")?.backgroundWords?.[0].end).toBe(5);
    expect(lineById("c1")?.backgroundWords?.[0].end).toBe(12);
  });

  describe("edge cases", () => {
    it.each([0, Number.NaN])("treats a song length of %s as no song end", (duration) => {
      seed(true);

      nudgeWordEnd(store().lines, 0, 1, 100, store().updateLineWithHistory, store().groups, duration);

      expect(lineById("c0")?.words?.[1].end).toBe(104);
      expect(lineById("c1")?.words?.[1].end).toBe(111);
    });
  });

  describe("regressions", () => {
    it("moves a last word of an old group without touching its sibling", () => {
      seed(false);

      nudgeWordEnd(store().lines, 0, 1, 3, store().updateLineWithHistory, store().groups, SONG_END);

      expect(lineById("c0")?.words?.[1].end).toBe(7);
      expect(lineById("c1")?.words?.[1].end).toBe(11);
    });
  });
});

describe("setWordBoundary with a shared time range", () => {
  const setBoundary = (lineIdx: number, edge: "begin" | "end", wordIdx: number, time: number) =>
    setWordBoundary({
      lines: store().lines,
      lineIdx,
      wordIdx,
      edge,
      time,
      minDuration: 0.05,
      rolling: false,
      syllablesFollowRolling: false,
      range: timeRangeResolver(store().lines, store().groups, 12)(store().lines[lineIdx]),
      updateLineWithHistory: store().updateLineWithHistory,
    });

  it("stops a first word begin where the earliest instance reaches zero", () => {
    seed(true);

    setBoundary(1, "begin", 0, 1);

    expect(lineById("c1")?.words?.[0].begin).toBe(7);
    expect(lineById("c0")?.words?.[0].begin).toBe(0);
  });

  it("stops a last word end where the latest instance reaches the song end", () => {
    seed(true);

    setBoundary(0, "end", 1, 100);

    expect(lineById("c0")?.words?.[1].end).toBe(5);
    expect(lineById("c1")?.words?.[1].end).toBe(12);
  });

  describe("regressions", () => {
    it("stops a line of an old group at zero, as before", () => {
      seed(false);

      setBoundary(1, "begin", 0, -1);

      expect(lineById("c1")?.words?.[0].begin).toBe(0);
    });
  });
});
