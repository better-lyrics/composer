import { describe, expect, it } from "vitest";
import { getEffectiveLines } from "@/domain/line/effective-words";
import { createLine } from "@/test/factories";
import { bgOps, retimeInto, makeLine, wordsOps } from "@/test/word-timing-harness";
import type { LineUpdate } from "@/domain/line/model";
import { wordBoundaryEdit, wordRetimeEdit } from "@/utils/timing/word-timing";

describe("createWordTimingOps: early returns", () => {
  it("nudgeBegin no-ops when line missing", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "begin", { by: 0.1 }, [], 0, 0);
    expect(calls).toHaveLength(0);
  });

  it("setBegin no-ops when wordIdx out of bounds", () => {
    const calls: LineUpdate[] = [];
    const lines = [createLine({ text: "Hello", words: [{ text: "Hello", begin: 0, end: 1 }] })];
    retimeInto(calls, wordsOps.retimeEdit, "begin", { to: 0.5 }, lines, 0, 5);
    expect(calls).toHaveLength(0);
  });

  it("nudgeEnd no-ops when getWords returns undefined", () => {
    const calls: LineUpdate[] = [];
    const lines = [createLine({ text: "Hello" })];
    retimeInto(calls, wordsOps.retimeEdit, "end", { by: 0.1 }, lines, 0, 0);
    expect(calls).toHaveLength(0);
  });
});

describe("createWordTimingOps: nudgeBegin / setBegin clamp", () => {
  it("nudgeBegin caps at prev word's end", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "begin", { by: -5 }, [makeLine()], 0, 1);
    expect((calls[0].updates.words ?? [])[1].begin).toBe(1);
  });

  it("nudgeBegin caps at word's own end", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "begin", { by: +5 }, [makeLine()], 0, 1);
    expect((calls[0].updates.words ?? [])[1].begin).toBe(2);
  });

  it("nudgeBegin caps at 0 for first word with no prev", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "begin", { by: -5 }, [makeLine()], 0, 0);
    expect((calls[0].updates.words ?? [])[0].begin).toBe(0);
  });

  it("setBegin clamps to [prev.end, word.end]", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "begin", { to: 0.5 }, [makeLine()], 0, 1);
    expect((calls[0].updates.words ?? [])[1].begin).toBe(1);
  });

  it("setBegin accepts an in-range value", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "begin", { to: 1.5 }, [makeLine()], 0, 1);
    expect((calls[0].updates.words ?? [])[1].begin).toBe(1.5);
  });
});

describe("createWordTimingOps: nudgeEnd / setEnd clamp", () => {
  it("nudgeEnd caps at next word's begin", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "end", { by: +5 }, [makeLine()], 0, 1);
    expect((calls[0].updates.words ?? [])[1].end).toBe(2);
  });

  it("nudgeEnd caps at word's own begin", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "end", { by: -5 }, [makeLine()], 0, 1);
    expect((calls[0].updates.words ?? [])[1].end).toBe(1);
  });

  it("nudgeEnd has no upper bound when next word is missing", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "end", { by: +100 }, [makeLine()], 0, 2);
    expect((calls[0].updates.words ?? [])[2].end).toBe(103);
  });

  it("setEnd clamps to [word.begin, next.begin]", () => {
    const calls: LineUpdate[] = [];
    retimeInto(calls, wordsOps.retimeEdit, "end", { to: 5 }, [makeLine()], 0, 1);
    expect((calls[0].updates.words ?? [])[1].end).toBe(2);
  });
});

describe("createWordTimingOps: write contract", () => {
  it("targets the updateKey configured by the factory (words)", () => {
    const calls: LineUpdate[] = [];
    const line = createLine({ text: "x", words: [{ text: "x", begin: 0, end: 1 }] });
    retimeInto(calls, wordsOps.retimeEdit, "begin", { to: 0.2 }, [line], 0, 0);
    expect("words" in calls[0].updates).toBe(true);
    expect("backgroundWords" in calls[0].updates).toBe(false);
  });

  it("targets the updateKey configured by the factory (backgroundWords)", () => {
    const calls: LineUpdate[] = [];
    const line = createLine({
      text: "Lead",
      backgroundText: "ooh",
      backgroundWords: [{ text: "ooh", begin: 0, end: 1 }],
    });
    retimeInto(calls, bgOps.retimeEdit, "begin", { to: 0.2 }, [line], 0, 0);
    expect("backgroundWords" in calls[0].updates).toBe(true);
    expect("words" in calls[0].updates).toBe(false);
  });

  it("produces a new words array (immutability)", () => {
    const calls: LineUpdate[] = [];
    const original = createLine({
      text: "a b",
      words: [
        { text: "a", begin: 0, end: 1 },
        { text: "b", begin: 1, end: 2 },
      ],
    });
    retimeInto(calls, wordsOps.retimeEdit, "begin", { to: 1.5 }, [original], 0, 1);
    expect(calls[0].updates.words).not.toBe(original.words);
  });

  it("does not mutate untouched words in the resulting array", () => {
    const calls: LineUpdate[] = [];
    const line = makeLine();
    retimeInto(calls, wordsOps.retimeEdit, "begin", { to: 1.5 }, [line], 0, 1);
    const out = calls[0].updates.words ?? [];
    expect(out[0]).toEqual({ text: "a", sep: " ", begin: 0, end: 1, joinsNext: false });
    expect(out[2]).toEqual({ text: "c", sep: "", begin: 2, end: 3, joinsNext: false });
  });
});

describe("main-track ops on effective lines", () => {
  it("regression [: set begin on a line-synced row writes begin/end, not words", () => {
    const calls: LineUpdate[] = [];
    const lines = getEffectiveLines([createLine({ text: "Line synced", begin: 17, end: 20 })]);
    retimeInto(calls, wordRetimeEdit, "begin", { to: 18 }, lines, 0, 0);
    expect(calls[0].updates).toEqual({ begin: 18, end: 20 });
  });

  it("regression info panel: set boundary on a line-synced row writes begin/end, not words", () => {
    const [line] = getEffectiveLines([createLine({ text: "Line synced", begin: 17, end: 20 })]);
    const edit = wordBoundaryEdit({
      line,
      wordIdx: 0,
      edge: "end",
      time: 21,
      minDuration: 0.05,
      rolling: false,
      syllablesFollowRolling: false,
    });
    expect(edit?.updates).toEqual({ begin: 17, end: 21 });
  });

  it("writes words and never text for a partially synced line", () => {
    const calls: LineUpdate[] = [];
    const lines = getEffectiveLines([createLine({ text: "a b", words: [{ text: "a", sep: " ", begin: 1, end: 2 }] })]);
    retimeInto(calls, wordRetimeEdit, "end", { by: 0.5 }, lines, 0, 0);
    expect(calls[0].updates).toEqual({ words: [{ text: "a", sep: " ", begin: 1, end: 2.5, joinsNext: false }] });
  });

  it("leaves a raw line-synced row alone because it has no words to edit", () => {
    const calls: LineUpdate[] = [];
    retimeInto(
      calls,
      wordRetimeEdit,
      "begin",
      { to: 18 },
      [createLine({ text: "Line synced", begin: 17, end: 20 })],
      0,
      0,
    );
    expect(calls).toHaveLength(0);
  });
});
