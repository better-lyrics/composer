import type { LyricLine } from "@/domain/line/model";
import type { BoundaryEdge } from "@/domain/word/boundary";
import { createLine } from "@/test/factories";
import { bgOps, captureUpdates, makeLine, wordsOps } from "@/test/word-timing-harness";
import { setBgWordBegin, setBgWordBoundary } from "@/utils/timing/bg-word-timing";
import { describe, expect, it } from "vitest";

describe("createWordTimingOps: setBoundary", () => {
  interface BoundaryCase {
    wordIdx: number;
    edge: BoundaryEdge;
    time: number;
    rolling: boolean;
    minDuration?: number;
    duration?: number;
    line?: LyricLine;
    lines?: LyricLine[];
  }

  function run(boundaryCase: BoundaryCase) {
    const { calls, updateLineWithHistory } = captureUpdates();
    const line = boundaryCase.line ?? makeLine();
    wordsOps.setBoundary({
      lines: boundaryCase.lines ?? [line],
      lineIdx: 0,
      wordIdx: boundaryCase.wordIdx,
      edge: boundaryCase.edge,
      time: boundaryCase.time,
      minDuration: boundaryCase.minDuration ?? 0.05,
      rolling: boundaryCase.rolling,
      ...(boundaryCase.duration !== undefined ? { duration: boundaryCase.duration } : {}),
      updateLineWithHistory,
    });
    return { calls, words: calls[0]?.updates.words ?? [] };
  }

  const gappedLine = () =>
    createLine({
      text: "a b",
      words: [
        { text: "a", begin: 0, end: 1 },
        { text: "b", begin: 1.5, end: 2.5 },
      ],
    });

  it("moves only the target word when rolling is off", () => {
    const { words } = run({ wordIdx: 1, edge: "begin", time: 1.5, rolling: false });
    expect(words[1].begin).toBe(1.5);
    expect(words[0]).toEqual({ text: "a", begin: 0, end: 1 });
  });

  it("drags the previous word's end along a flush begin boundary when rolling", () => {
    const { words } = run({ wordIdx: 1, edge: "begin", time: 1.5, rolling: true });
    expect(words[1].begin).toBe(1.5);
    expect(words[0].end).toBe(1.5);
  });

  it("drags the next word's begin along a flush end boundary when rolling", () => {
    const { words } = run({ wordIdx: 1, edge: "end", time: 1.5, rolling: true });
    expect(words[1].end).toBe(1.5);
    expect(words[2].begin).toBe(1.5);
  });

  it("leaves the neighbour alone across a gap, even when rolling", () => {
    const fromBegin = run({ line: gappedLine(), wordIdx: 1, edge: "begin", time: 1.2, rolling: true });
    expect(fromBegin.words[1].begin).toBe(1.2);
    expect(fromBegin.words[0].end).toBe(1);
    const fromEnd = run({ line: gappedLine(), wordIdx: 0, edge: "end", time: 1.3, rolling: true });
    expect(fromEnd.words[0].end).toBe(1.3);
    expect(fromEnd.words[1].begin).toBe(1.5);
  });

  it("does not roll at the first index for begin", () => {
    const { words } = run({ wordIdx: 0, edge: "begin", time: 0.5, rolling: true });
    expect(words[0].begin).toBe(0.5);
    expect(words[1]).toEqual({ text: "b", begin: 1, end: 2 });
  });

  it("does not roll at the last index for end", () => {
    const { words } = run({ wordIdx: 2, edge: "end", time: 4, rolling: true });
    expect(words[2].end).toBe(4);
    expect(words[1]).toEqual({ text: "b", begin: 1, end: 2 });
  });

  it("keeps the target word at least minDuration long", () => {
    expect(run({ wordIdx: 1, edge: "begin", time: 5, rolling: false }).words[1].begin).toBeCloseTo(1.95, 10);
    expect(run({ wordIdx: 1, edge: "end", time: 0, rolling: false }).words[1].end).toBeCloseTo(1.05, 10);
  });

  it("keeps the rolled neighbour at least minDuration long", () => {
    const rolledBack = run({ wordIdx: 1, edge: "begin", time: -5, rolling: true });
    expect(rolledBack.words[0].end).toBeCloseTo(0.05, 10);
    expect(rolledBack.words[1].begin).toBeCloseTo(0.05, 10);
    const rolledForward = run({ wordIdx: 1, edge: "end", time: 99, rolling: true });
    expect(rolledForward.words[2].begin).toBeCloseTo(2.95, 10);
    expect(rolledForward.words[1].end).toBeCloseTo(2.95, 10);
  });

  it("heals an overlapping pair when rolling a flush begin boundary", () => {
    const overlapping = createLine({
      text: "a b",
      words: [
        { text: "a", begin: 0, end: 1.2 },
        { text: "b", begin: 1, end: 2 },
      ],
    });
    const { words } = run({ line: overlapping, wordIdx: 1, edge: "begin", time: 1.5, rolling: true });
    expect(words[1].begin).toBe(1.5);
    expect(words[0].end).toBe(1.5);
  });

  it("caps the last word's end at the audio duration", () => {
    const { words } = run({ wordIdx: 2, edge: "end", time: 99, rolling: false, duration: 5 });
    expect(words[2].end).toBe(5);
  });

  it("caps at the next word's begin when that is earlier than the audio duration", () => {
    const { words } = run({ wordIdx: 1, edge: "end", time: 99, rolling: false, duration: 5 });
    expect(words[1].end).toBe(2);
  });

  it("leaves the end unbounded when no duration is supplied", () => {
    expect(run({ wordIdx: 2, edge: "end", time: 99, rolling: false }).words[2].end).toBe(99);
  });

  it("calls updateLineWithHistory exactly once when rolling", () => {
    expect(run({ wordIdx: 1, edge: "begin", time: 1.5, rolling: true }).calls).toHaveLength(1);
    expect(run({ wordIdx: 1, edge: "end", time: 1.5, rolling: true }).calls).toHaveLength(1);
  });

  it("passes propagateToSiblings: false", () => {
    const { calls } = run({ wordIdx: 1, edge: "begin", time: 1.5, rolling: true });
    expect(calls[0].options?.propagateToSiblings).toBe(false);
  });

  describe("edge cases", () => {
    it("no-ops when the line is missing", () => {
      expect(run({ lines: [], wordIdx: 0, edge: "begin", time: 1, rolling: true }).calls).toHaveLength(0);
    });

    it("no-ops when the word index is out of range", () => {
      expect(run({ wordIdx: 9, edge: "begin", time: 1, rolling: true }).calls).toHaveLength(0);
    });

    it("no-ops when getWords returns undefined", () => {
      const { calls, updateLineWithHistory } = captureUpdates();
      setBgWordBoundary({
        lines: [createLine({ text: "Lead" })],
        lineIdx: 0,
        wordIdx: 0,
        edge: "begin",
        time: 1,
        minDuration: 0.05,
        rolling: true,
        updateLineWithHistory,
      });
      expect(calls).toHaveLength(0);
    });

    it("never sets a begin below zero", () => {
      expect(run({ wordIdx: 0, edge: "begin", time: -5, rolling: false }).words[0].begin).toBe(0);
      expect(run({ wordIdx: 0, edge: "begin", time: -5, rolling: true }).words[0].begin).toBe(0);
    });
  });

  describe("regressions", () => {
    it("regression: never inverts a word when the flush pair is shorter than twice minDuration", () => {
      const tight = () =>
        createLine({
          text: "a b",
          words: [
            { text: "a", begin: 0.9, end: 1 },
            { text: "b", begin: 1, end: 1.02 },
          ],
        });
      const rolledBack = run({ line: tight(), wordIdx: 1, edge: "begin", time: 0.95, minDuration: 0.5, rolling: true });
      expect(rolledBack.words[1].begin).toBeLessThanOrEqual(rolledBack.words[1].end);
      expect(rolledBack.words[0].begin).toBeLessThanOrEqual(rolledBack.words[0].end);
      const rolledOn = run({ line: tight(), wordIdx: 0, edge: "end", time: 0.95, minDuration: 0.5, rolling: true });
      expect(rolledOn.words[0].begin).toBeLessThanOrEqual(rolledOn.words[0].end);
      expect(rolledOn.words[1].begin).toBeLessThanOrEqual(rolledOn.words[1].end);
    });

    it("regression: never inverts a word whose begin is past a shorter audio duration", () => {
      const lastWord = run({ wordIdx: 2, edge: "end", time: 99, rolling: false, duration: 1.5 });
      expect(lastWord.words[2].begin).toBeLessThanOrEqual(lastWord.words[2].end);
      const rolled = run({ wordIdx: 1, edge: "end", time: 99, rolling: true, duration: 0.5 });
      expect(rolled.words[1].begin).toBeLessThanOrEqual(rolled.words[1].end);
      expect(rolled.words[2].begin).toBeLessThanOrEqual(rolled.words[2].end);
    });
  });

  describe("invariants", () => {
    it("never lets a word's begin exceed its end", () => {
      const { words } = run({ wordIdx: 1, edge: "begin", time: 99, rolling: true });
      expect(words[1]).toEqual({ text: "b", begin: 1.95, end: 2 });
    });

    it("does not modify the input words array", () => {
      const line = makeLine();
      const snapshot = structuredClone(line.words);
      const { calls } = run({ line, wordIdx: 1, edge: "begin", time: 1.5, rolling: true });
      expect(line.words).toEqual(snapshot);
      expect(calls[0].updates.words).not.toBe(line.words);
    });
  });
});

describe("setBoundary write shape vs mutateWord write shape", () => {
  function bgLine() {
    return createLine({
      text: "Lead",
      backgroundText: "ooh aah",
      backgroundWords: [
        { text: "ooh ", begin: 0, end: 1 },
        { text: "aah", begin: 1, end: 2 },
      ],
    });
  }

  function runBgBoundary() {
    const { calls, updateLineWithHistory } = captureUpdates();
    setBgWordBoundary({
      lines: [bgLine()],
      lineIdx: 0,
      wordIdx: 1,
      edge: "begin",
      time: 1.5,
      minDuration: 0.05,
      rolling: false,
      updateLineWithHistory,
    });
    return calls;
  }

  it("setBoundary marks a background edit as manual", () => {
    const calls = runBgBoundary();
    expect(calls[0].updates.backgroundTextSource).toBe("manual");
    expect((calls[0].updates.backgroundWords ?? [])[1].begin).toBe(1.5);
  });

  it("setBoundary leaves backgroundText unchanged for a timing-only edit", () => {
    expect(runBgBoundary()[0].updates.backgroundText).toBe("ooh aah");
  });

  it("setBgWordBegin still writes raw, leaving background provenance untouched", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    setBgWordBegin([bgLine()], 0, 1, 1.5, updateLineWithHistory);
    expect("backgroundTextSource" in calls[0].updates).toBe(false);
    expect("backgroundText" in calls[0].updates).toBe(false);
    expect((calls[0].updates.backgroundWords ?? [])[1].begin).toBe(1.5);
  });

  it("an instance without a buildUpdate hook writes only the word array", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    bgOps.setBegin([bgLine()], 0, 1, 1.5, updateLineWithHistory);
    expect(Object.keys(calls[0].updates)).toEqual(["backgroundWords"]);
  });
});
