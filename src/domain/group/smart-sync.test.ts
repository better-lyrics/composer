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
      { id: "w1", text: "I", sep: "", begin: 0, end: 1, joinsNext: true },
      { id: "w2", text: "go", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    const after: WordTiming[] = [
      { id: "w3", text: "I", sep: "", begin: 0, end: 1, joinsNext: true },
      { id: "w4", text: "run", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w5", text: "I", sep: "", begin: 10, end: 11, joinsNext: true },
      { id: "w6", text: "go", sep: "", begin: 11, end: 12, joinsNext: false },
    ];
    expect(propagateWordChanges(after, before, sibling)).toEqual([
      { text: "I", sep: "", begin: 10, end: 11, joinsNext: true },
      { text: "run", sep: "", begin: 11, end: 12, joinsNext: false },
    ]);
  });

  it("regression: a split mark typed on the source joins the linked copy too", () => {
    const before: WordTiming[] = [
      { id: "w1", text: "hel", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w2", text: "lo", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    const after: WordTiming[] = [
      { id: "w1", text: "hel", sep: "", begin: 0, end: 1, joinsNext: true },
      { id: "w2", text: "lo", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w5", text: "hel", sep: " ", begin: 10, end: 11, joinsNext: false },
      { id: "w6", text: "lo", sep: "", begin: 11, end: 12, joinsNext: false },
    ];
    expect(propagateWordChanges(after, before, sibling)?.map((word) => word.joinsNext)).toEqual([true, false]);
  });

  it("fast path: returns undefined when no sibling text actually changed", () => {
    const words: WordTiming[] = [{ id: "w7", text: "I", sep: "", begin: 0, end: 1, joinsNext: false }];
    expect(
      propagateWordChanges(words, words, [{ id: "w8", text: "I", sep: "", begin: 9, end: 9.5, joinsNext: false }]),
    ).toBeUndefined();
  });

  it("text edit on a sibling whose count diverged: takes the source structure inside the sibling's own span", () => {
    const before: WordTiming[] = [{ id: "w9", text: "I", sep: "", begin: 0, end: 1, joinsNext: false }];
    const after: WordTiming[] = [{ id: "w10", text: "X", sep: "", begin: 0, end: 1, joinsNext: false }];
    const sibling: WordTiming[] = [
      { id: "w11", text: "I", sep: "", begin: 9, end: 10, joinsNext: true },
      { id: "w12", text: "extra", sep: "", begin: 10, end: 11, joinsNext: false },
    ];
    expect(propagateWordChanges(after, before, sibling)).toEqual([
      { text: "X", sep: "", begin: 9, end: 11, joinsNext: false },
    ]);
  });

  it("regression: leaves a diverged sibling alone when the source words did not change", () => {
    const words: WordTiming[] = [{ id: "w13", text: "ooh", sep: "", begin: 0, end: 1, joinsNext: false }];
    const sibling: WordTiming[] = [
      { id: "w14", text: "oo", sep: "", begin: 9, end: 9.5, joinsNext: true },
      { id: "w15", text: "oh", sep: "", begin: 9.5, end: 10, joinsNext: false },
    ];
    expect(propagateWordChanges([...words], words, sibling)).toBeUndefined();
  });

  it("structural change: delegates to the smart-sync diff, preserving unchanged sibling timing", () => {
    const before: WordTiming[] = [
      { id: "w16", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w17", text: "love", sep: " ", begin: 0.3, end: 0.6, joinsNext: false },
      { id: "w18", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const after: WordTiming[] = [
      { id: "w19", text: "I", sep: " ", begin: 0, end: 0.3, joinsNext: false },
      { id: "w20", text: "lo", sep: "", begin: 0.3, end: 0.45, joinsNext: true },
      { id: "w21", text: "ve", sep: " ", begin: 0.45, end: 0.6, joinsNext: false },
      { id: "w22", text: "you", sep: "", begin: 0.6, end: 1, joinsNext: false },
    ];
    const sibling: WordTiming[] = [
      { id: "w23", text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false },
      { id: "w24", text: "love", sep: " ", begin: 30.4, end: 30.7, joinsNext: false },
      { id: "w25", text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false },
    ];

    const result = propagateWordChanges(after, before, sibling);
    expect(result).toHaveLength(4);
    expect(result?.[0]).toEqual({ text: "I", sep: " ", begin: 30, end: 30.4, joinsNext: false });
    expect(result?.[3]).toEqual({ text: "you", sep: "", begin: 30.7, end: 31.2, joinsNext: false });
  });
});
