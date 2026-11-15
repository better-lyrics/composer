import { propagateWordChanges } from "@/domain/group/smart-sync";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

// -- propagateWordChanges -----------------------------------------------------

describe("propagateWordChanges", () => {
  it("returns undefined when sourceAfter is missing", () => {
    expect(propagateWordChanges(undefined, [], [])).toBeUndefined();
  });

  it("returns undefined when siblingWords is missing", () => {
    expect(propagateWordChanges([], [], undefined)).toBeUndefined();
  });

  it("fast path: renames sibling word text on an unchanged count, keeping timing exact", () => {
    const before: WordTiming[] = [
      { text: "I", sep: "", begin: 0, end: 1 },
      { text: "go", sep: "", begin: 1, end: 2 },
    ];
    const after: WordTiming[] = [
      { text: "I", sep: "", begin: 0, end: 1 },
      { text: "run", sep: "", begin: 1, end: 2 },
    ];
    const sibling: WordTiming[] = [
      { text: "I", sep: "", begin: 10, end: 11 },
      { text: "go", sep: "", begin: 11, end: 12 },
    ];
    expect(propagateWordChanges(after, before, sibling)).toEqual([
      { text: "I", sep: "", begin: 10, end: 11 },
      { text: "run", sep: "", begin: 11, end: 12 },
    ]);
  });

  it("fast path: returns undefined when no sibling text actually changed", () => {
    const words: WordTiming[] = [{ text: "I", sep: "", begin: 0, end: 1 }];
    expect(propagateWordChanges(words, words, [{ text: "I", sep: "", begin: 9, end: 9.5 }])).toBeUndefined();
  });

  it("text edit on a sibling whose count diverged: takes the source structure inside the sibling's own span", () => {
    const before: WordTiming[] = [{ text: "I", sep: "", begin: 0, end: 1 }];
    const after: WordTiming[] = [{ text: "X", sep: "", begin: 0, end: 1 }];
    const sibling: WordTiming[] = [
      { text: "I", sep: "", begin: 9, end: 10 },
      { text: "extra", sep: "", begin: 10, end: 11 },
    ];
    expect(propagateWordChanges(after, before, sibling)).toEqual([{ text: "X", sep: "", begin: 9, end: 11 }]);
  });

  it("regression: leaves a diverged sibling alone when the source words did not change", () => {
    const words: WordTiming[] = [{ text: "ooh", sep: "", begin: 0, end: 1 }];
    const sibling: WordTiming[] = [
      { text: "oo", sep: "", begin: 9, end: 9.5 },
      { text: "oh", sep: "", begin: 9.5, end: 10 },
    ];
    expect(propagateWordChanges([...words], words, sibling)).toBeUndefined();
  });

  it("structural change: delegates to the smart-sync diff, preserving unchanged sibling timing", () => {
    const before: WordTiming[] = [
      { text: "I", sep: " ", begin: 0, end: 0.3 },
      { text: "love", sep: " ", begin: 0.3, end: 0.6 },
      { text: "you", sep: "", begin: 0.6, end: 1 },
    ];
    const after: WordTiming[] = [
      { text: "I", sep: " ", begin: 0, end: 0.3 },
      { text: "lo", sep: "", begin: 0.3, end: 0.45 },
      { text: "ve", sep: " ", begin: 0.45, end: 0.6 },
      { text: "you", sep: "", begin: 0.6, end: 1 },
    ];
    const sibling: WordTiming[] = [
      { text: "I", sep: " ", begin: 30, end: 30.4 },
      { text: "love", sep: " ", begin: 30.4, end: 30.7 },
      { text: "you", sep: "", begin: 30.7, end: 31.2 },
    ];

    const result = propagateWordChanges(after, before, sibling);
    expect(result).toHaveLength(4);
    expect(result?.[0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4 });
    expect(result?.[3]).toEqual({ text: "you", sep: "", begin: 30.7, end: 31.2 });
  });
});
