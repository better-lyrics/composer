import { getEffectiveLines } from "@/domain/line/effective-words";
import { createLine } from "@/test/factories";
import { bgOps, captureUpdates, makeLine, wordsOps } from "@/test/word-timing-harness";
import { nudgeWordEnd, setWordBegin, setWordBoundary } from "@/utils/timing/word-timing";
import { describe, expect, it } from "vitest";

describe("createWordTimingOps: early returns", () => {
  it("nudgeBegin no-ops when line missing", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.nudgeBegin([], 0, 0, 0.1, updateLineWithHistory);
    expect(calls).toHaveLength(0);
  });

  it("setBegin no-ops when wordIdx out of bounds", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const lines = [createLine({ text: "Hello", words: [{ text: "Hello", begin: 0, end: 1 }] })];
    wordsOps.setBegin(lines, 0, 5, 0.5, updateLineWithHistory);
    expect(calls).toHaveLength(0);
  });

  it("nudgeEnd no-ops when getWords returns undefined", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const lines = [createLine({ text: "Hello" })];
    wordsOps.nudgeEnd(lines, 0, 0, 0.1, updateLineWithHistory);
    expect(calls).toHaveLength(0);
  });
});

describe("createWordTimingOps: nudgeBegin / setBegin clamp", () => {
  it("nudgeBegin caps at prev word's end", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.nudgeBegin([makeLine()], 0, 1, -5, updateLineWithHistory);
    expect((calls[0].updates.words ?? [])[1].begin).toBe(1);
  });

  it("nudgeBegin caps at word's own end", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.nudgeBegin([makeLine()], 0, 1, +5, updateLineWithHistory);
    expect((calls[0].updates.words ?? [])[1].begin).toBe(2);
  });

  it("nudgeBegin caps at 0 for first word with no prev", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.nudgeBegin([makeLine()], 0, 0, -5, updateLineWithHistory);
    expect((calls[0].updates.words ?? [])[0].begin).toBe(0);
  });

  it("setBegin clamps to [prev.end, word.end]", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.setBegin([makeLine()], 0, 1, 0.5, updateLineWithHistory);
    expect((calls[0].updates.words ?? [])[1].begin).toBe(1);
  });

  it("setBegin accepts an in-range value", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.setBegin([makeLine()], 0, 1, 1.5, updateLineWithHistory);
    expect((calls[0].updates.words ?? [])[1].begin).toBe(1.5);
  });
});

describe("createWordTimingOps: nudgeEnd / setEnd clamp", () => {
  it("nudgeEnd caps at next word's begin", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.nudgeEnd([makeLine()], 0, 1, +5, updateLineWithHistory);
    expect((calls[0].updates.words ?? [])[1].end).toBe(2);
  });

  it("nudgeEnd caps at word's own begin", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.nudgeEnd([makeLine()], 0, 1, -5, updateLineWithHistory);
    expect((calls[0].updates.words ?? [])[1].end).toBe(1);
  });

  it("nudgeEnd has no upper bound when next word is missing", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.nudgeEnd([makeLine()], 0, 2, +100, updateLineWithHistory);
    expect((calls[0].updates.words ?? [])[2].end).toBe(103);
  });

  it("setEnd clamps to [word.begin, next.begin]", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    wordsOps.setEnd([makeLine()], 0, 1, 5, updateLineWithHistory);
    expect((calls[0].updates.words ?? [])[1].end).toBe(2);
  });
});

describe("createWordTimingOps: write contract", () => {
  it("always passes propagateToSiblings: false", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const line = createLine({ text: "x", words: [{ text: "x", begin: 0, end: 1 }] });
    wordsOps.setBegin([line], 0, 0, 0.2, updateLineWithHistory);
    expect(calls[0].options?.propagateToSiblings).toBe(false);
  });

  it("targets the updateKey configured by the factory (words)", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const line = createLine({ text: "x", words: [{ text: "x", begin: 0, end: 1 }] });
    wordsOps.setBegin([line], 0, 0, 0.2, updateLineWithHistory);
    expect("words" in calls[0].updates).toBe(true);
    expect("backgroundWords" in calls[0].updates).toBe(false);
  });

  it("targets the updateKey configured by the factory (backgroundWords)", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const line = createLine({
      text: "Lead",
      backgroundText: "ooh",
      backgroundWords: [{ text: "ooh", begin: 0, end: 1 }],
    });
    bgOps.setBegin([line], 0, 0, 0.2, updateLineWithHistory);
    expect("backgroundWords" in calls[0].updates).toBe(true);
    expect("words" in calls[0].updates).toBe(false);
  });

  it("produces a new words array (immutability)", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const original = createLine({
      text: "a b",
      words: [
        { text: "a", begin: 0, end: 1 },
        { text: "b", begin: 1, end: 2 },
      ],
    });
    wordsOps.setBegin([original], 0, 1, 1.5, updateLineWithHistory);
    expect(calls[0].updates.words).not.toBe(original.words);
  });

  it("does not mutate untouched words in the resulting array", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const line = makeLine();
    wordsOps.setBegin([line], 0, 1, 1.5, updateLineWithHistory);
    const out = calls[0].updates.words ?? [];
    expect(out[0]).toEqual({ text: "a ", begin: 0, end: 1 });
    expect(out[2]).toEqual({ text: "c", begin: 2, end: 3 });
  });
});

describe("main-track ops on effective lines", () => {
  it("regression [: set begin on a line-synced row writes begin/end, not words", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const lines = getEffectiveLines([createLine({ text: "Line synced", begin: 17, end: 20 })]);
    setWordBegin(lines, 0, 0, 18, updateLineWithHistory);
    expect(calls[0].updates).toEqual({ begin: 18, end: 20 });
  });

  it("regression info panel: set boundary on a line-synced row writes begin/end, not words", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const lines = getEffectiveLines([createLine({ text: "Line synced", begin: 17, end: 20 })]);
    setWordBoundary({
      lines,
      lineIdx: 0,
      wordIdx: 0,
      edge: "end",
      time: 21,
      minDuration: 0.05,
      rolling: false,
      syllablesFollowRolling: false,
      updateLineWithHistory,
    });
    expect(calls[0].updates).toEqual({ begin: 17, end: 21 });
  });

  it("writes words and never text for a partially synced line", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    const lines = getEffectiveLines([createLine({ text: "a b", words: [{ text: "a ", begin: 1, end: 2 }] })]);
    nudgeWordEnd(lines, 0, 0, 0.5, updateLineWithHistory);
    expect(calls[0].updates).toEqual({ words: [{ text: "a ", begin: 1, end: 2.5 }] });
  });

  it("leaves a raw line-synced row alone because it has no words to edit", () => {
    const { calls, updateLineWithHistory } = captureUpdates();
    setWordBegin([createLine({ text: "Line synced", begin: 17, end: 20 })], 0, 0, 18, updateLineWithHistory);
    expect(calls).toHaveLength(0);
  });
});
