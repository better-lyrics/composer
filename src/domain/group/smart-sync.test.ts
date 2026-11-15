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
      { id: "w1", text: "I", sep: "", begin: 0, end: 1 },
      { id: "w2", text: "go", sep: "", begin: 1, end: 2 },
    ];
    const after: WordTiming[] = [
      { id: "w3", text: "I", sep: "", begin: 0, end: 1 },
      { id: "w4", text: "run", sep: "", begin: 1, end: 2 },
    ];
    const sibling: WordTiming[] = [
      { id: "w5", text: "I", sep: "", begin: 10, end: 11 },
      { id: "w6", text: "go", sep: "", begin: 11, end: 12 },
    ];
    expect(propagateWordChanges(after, before, sibling)).toEqual([
      { text: "I", sep: "", begin: 10, end: 11 },
      { text: "run", sep: "", begin: 11, end: 12 },
    ]);
  });

  it("fast path: returns undefined when no sibling text actually changed", () => {
    const words: WordTiming[] = [{ id: "w7", text: "I", sep: "", begin: 0, end: 1 }];
    expect(propagateWordChanges(words, words, [{ id: "w8", text: "I", sep: "", begin: 9, end: 9.5 }])).toBeUndefined();
  });

  it("text edit on a sibling whose count diverged: takes the source structure inside the sibling's own span", () => {
    const before: WordTiming[] = [{ id: "w9", text: "I", sep: "", begin: 0, end: 1 }];
    const after: WordTiming[] = [{ id: "w10", text: "X", sep: "", begin: 0, end: 1 }];
    const sibling: WordTiming[] = [
      { id: "w11", text: "I", sep: "", begin: 9, end: 10 },
      { id: "w12", text: "extra", sep: "", begin: 10, end: 11 },
    ];
    expect(propagateWordChanges(after, before, sibling)).toEqual([{ text: "X", sep: "", begin: 9, end: 11 }]);
  });

  it("regression: leaves a diverged sibling alone when the source words did not change", () => {
    const words: WordTiming[] = [{ id: "w13", text: "ooh", sep: "", begin: 0, end: 1 }];
    const sibling: WordTiming[] = [
      { id: "w14", text: "oo", sep: "", begin: 9, end: 9.5 },
      { id: "w15", text: "oh", sep: "", begin: 9.5, end: 10 },
    ];
    expect(propagateWordChanges([...words], words, sibling)).toBeUndefined();
  });

  it("structural change: delegates to the smart-sync diff, preserving unchanged sibling timing", () => {
    const before: WordTiming[] = [
      { id: "w16", text: "I", sep: " ", begin: 0, end: 0.3 },
      { id: "w17", text: "love", sep: " ", begin: 0.3, end: 0.6 },
      { id: "w18", text: "you", sep: "", begin: 0.6, end: 1 },
    ];
    const after: WordTiming[] = [
      { id: "w19", text: "I", sep: " ", begin: 0, end: 0.3 },
      { id: "w20", text: "lo", sep: "", begin: 0.3, end: 0.45 },
      { id: "w21", text: "ve", sep: " ", begin: 0.45, end: 0.6 },
      { id: "w22", text: "you", sep: "", begin: 0.6, end: 1 },
    ];
    const sibling: WordTiming[] = [
      { id: "w23", text: "I", sep: " ", begin: 30, end: 30.4 },
      { id: "w24", text: "love", sep: " ", begin: 30.4, end: 30.7 },
      { id: "w25", text: "you", sep: "", begin: 30.7, end: 31.2 },
    ];

    const result = propagateWordChanges(after, before, sibling);
    expect(result).toHaveLength(4);
    expect(result?.[0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4 });
    expect(result?.[3]).toEqual({ text: "you", sep: "", begin: 30.7, end: 31.2 });
  });
});
