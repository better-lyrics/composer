import type { WordTiming } from "@/domain/word/timing";
import { applyWordPatch } from "@/utils/word-patch";
import { describe, expect, it } from "vitest";

// -- Raw-pattern bug demonstration --------------------------------------------

describe("raw spread-and-assign pattern (unsafe, motivates the helper)", () => {
  it("produces a textless entry and a sparse hole when wordIndex is out of bounds", () => {
    const words: WordTiming[] = [{ id: "w1", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false }];
    const wordIndex = 3;
    const result = [...words];
    result[wordIndex] = { ...result[wordIndex], begin: 5, end: 6 };

    expect(result).toHaveLength(4);
    expect(result[wordIndex]).toEqual({ begin: 5, end: 6 });
    expect("text" in (result[wordIndex] as object)).toBe(false);
    expect(Object.hasOwn(result, 1)).toBe(false);
    expect(Object.hasOwn(result, 2)).toBe(false);
  });
});

// -- applyWordPatch -----------------------------------------------------------

describe("applyWordPatch", () => {
  it("patches a word in range", () => {
    const words: WordTiming[] = [
      { id: "w2", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w3", text: "two", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    const result = applyWordPatch(words, 1, { begin: 1.5, end: 2.5 });
    expect(result).toEqual([
      { text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { text: "two", sep: "", begin: 1.5, end: 2.5, joinsNext: false },
    ]);
  });

  it("patches the adjacent word too when provided", () => {
    const words: WordTiming[] = [
      { id: "w4", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w5", text: "two", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    const result = applyWordPatch(words, 0, { end: 1.5 }, { index: 1, updates: { begin: 1.5 } });
    expect(result).toEqual([
      { text: "one", sep: " ", begin: 0, end: 1.5, joinsNext: false },
      { text: "two", sep: "", begin: 1.5, end: 2, joinsNext: false },
    ]);
  });

  it("returns the same reference shape but a new array (input unchanged)", () => {
    const words: WordTiming[] = [{ id: "w6", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false }];
    const result = applyWordPatch(words, 0, { begin: 0.5 });
    expect(result).not.toBe(words);
    expect(words[0]).toEqual({ text: "one", sep: " ", begin: 0, end: 1, joinsNext: false });
  });

  it("returns null when wordIndex is out of bounds (stale index after undo)", () => {
    const words: WordTiming[] = [{ id: "w7", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false }];
    expect(applyWordPatch(words, 3, { begin: 5, end: 6 })).toBeNull();
  });

  it("returns null when wordIndex equals the array length", () => {
    const words: WordTiming[] = [{ id: "w8", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false }];
    expect(applyWordPatch(words, 1, { begin: 5, end: 6 })).toBeNull();
  });

  it("returns null when wordIndex is negative", () => {
    const words: WordTiming[] = [{ id: "w9", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false }];
    expect(applyWordPatch(words, -1, { begin: 5, end: 6 })).toBeNull();
  });

  it("returns null when the adjacent index is out of bounds", () => {
    const words: WordTiming[] = [{ id: "w10", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false }];
    expect(applyWordPatch(words, 0, { begin: 0.5 }, { index: 5, updates: { begin: 1 } })).toBeNull();
  });

  it("returns null when the adjacent index is negative", () => {
    const words: WordTiming[] = [
      { id: "w11", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w12", text: "two", sep: "", begin: 1, end: 2, joinsNext: false },
    ];
    expect(applyWordPatch(words, 0, { end: 1.5 }, { index: -1, updates: { begin: 1.5 } })).toBeNull();
  });

  it("returns null when given an empty array", () => {
    expect(applyWordPatch([], 0, { begin: 0, end: 1 })).toBeNull();
  });

  it("preserves text on the patched entry", () => {
    const words: WordTiming[] = [{ id: "w13", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false }];
    const result = applyWordPatch(words, 0, { begin: 5, end: 6 });
    expect(result?.[0]).toMatchObject({ text: "one", sep: " " });
  });
});
