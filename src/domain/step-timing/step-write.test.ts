import { describe, expect, it } from "vitest";
import { UNBOUNDED_TIME_RANGE } from "@/domain/group/shared-timing";
import { applyStepKey } from "@/domain/step-timing/step-write";
import type { WordTiming } from "@/domain/word/timing";

const w = (text: string, begin: number, end: number): WordTiming => ({ text, begin, end });
const MIN = 0.05;
const step = (words: WordTiming[], index: number, key: "start" | "step" | "end", time: number) =>
  applyStepKey({ words, index, key, time, minDuration: MIN, range: UNBOUNDED_TIME_RANGE });

// Auto-align put the line late: the voice ends "Counting" at 17.86, but every block sits earlier and crammed.
const stale = [
  w("Counting ", 17.4, 17.54),
  w("every ", 17.56, 17.7),
  w("window ", 17.72, 17.86),
  w("in", 17.92, 18.24),
];

describe("applyStepKey", () => {
  it("ends the cursor word and starts the next at the same time", () => {
    const result = step(stale, 0, "step", 17.86);
    expect(result.kind).toBe("written");
    if (result.kind !== "written") return;
    expect(result.words[0]).toMatchObject({ begin: 17.4, end: 17.86 });
    expect(result.words[1].begin).toBe(17.86);
  });

  it("pushes only the stale words in the way, each to the minimum length, and stops at the first that fits", () => {
    const result = step(stale, 0, "step", 17.86);
    if (result.kind !== "written") throw new Error("refused");
    expect(result.words[1].end).toBeCloseTo(17.91);
    expect(result.words[2].begin).toBeCloseTo(17.91);
    expect(result.words[2].end).toBeCloseTo(17.96);
    expect(result.words[3]).toMatchObject({ begin: 17.96, end: 18.24 });
    for (let i = 1; i < result.words.length; i++) {
      expect(result.words[i].begin).toBeGreaterThanOrEqual(result.words[i - 1].end - 1e-9);
    }
  });

  it("pulls back only the cursor word when the time is before its start", () => {
    const words = [w("said ", 21.16, 21.42), w("we'd ", 21.96, 22.14)];
    const result = step(words, 1, "end", 21.66);
    if (result.kind !== "written") throw new Error("refused");
    expect(result.words[0]).toEqual(words[0]);
    expect(result.words[1].begin).toBeCloseTo(21.61);
    expect(result.words[1].end).toBe(21.66);
  });

  it("refuses a pull back that would cross the previous word and names that word", () => {
    const words = [w("the ", 18.96, 19.08), w("rain", 19.08, 19.9)];
    expect(step(words, 1, "step", 19.0)).toEqual({
      kind: "refused",
      refusal: { reason: "beforePrevious", previousWord: "the " },
    });
  });

  it("ends the previous word at the time when the start lands inside it", () => {
    const words = [w("the ", 10.0, 10.4), w("wave", 10.4, 11.2)];
    const result = step(words, 1, "start", 10.2);
    expect(result).toEqual({
      kind: "written",
      words: [w("the ", 10.0, 10.2), w("wave", 10.2, 11.2)],
      endedPrevious: "the ",
    });
  });

  it("refuses a start that would leave the previous word shorter than the minimum", () => {
    const words = [w("the ", 10.0, 10.4), w("wave", 10.4, 11.2)];
    const refused = { kind: "refused", refusal: { reason: "beforePrevious", previousWord: "the " } };
    expect(step(words, 1, "start", 10.03)).toEqual(refused);
    expect(step(words, 1, "start", 9.8)).toEqual(refused);
  });

  it("acts like the end key on the last word of a line and writes nothing after it", () => {
    const words = [w("down ", 15.58, 15.86), w("drain", 16.04, 16.8)];
    const result = step(words, 1, "step", 16.9);
    if (result.kind !== "written") throw new Error("refused");
    expect(result.words).toEqual([words[0], w("drain", 16.04, 16.9)]);
  });
});
