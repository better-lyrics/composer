import { enforceOrderAround } from "@/domain/word/order";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function isOrdered(words: WordTiming[]): boolean {
  for (let i = 0; i < words.length; i++) {
    if (words[i].end < words[i].begin) return false;
    if (i > 0 && words[i].begin < words[i - 1].end) return false;
  }
  return true;
}

// -- Tests --------------------------------------------------------------------

describe("enforceOrderAround", () => {
  it("leaves an already ordered tail untouched", () => {
    const words: WordTiming[] = [
      { id: "w1", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w2", text: "two", sep: " ", begin: 1, end: 2, joinsNext: false },
      { id: "w3", text: "three", sep: "", begin: 2, end: 3, joinsNext: false },
    ];
    expect(enforceOrderAround(words, 0)).toBe(words);
  });

  it("squeezes a single overlapping successor forward", () => {
    const words: WordTiming[] = [
      { id: "w4", text: "one", sep: " ", begin: 0.5, end: 0.8, joinsNext: false },
      { id: "w5", text: "two", sep: " ", begin: 0.4, end: 0.8, joinsNext: false },
      { id: "w6", text: "three", sep: "", begin: 0.8, end: 1.2, joinsNext: false },
    ];
    expect(enforceOrderAround(words, 0)).toEqual([
      { text: "one", sep: " ", begin: 0.5, end: 0.8, joinsNext: false },
      { text: "two", sep: " ", begin: 0.8, end: 0.8, joinsNext: false },
      { text: "three", sep: "", begin: 0.8, end: 1.2, joinsNext: false },
    ]);
  });

  it("cascades when the anchor lands past the whole tail", () => {
    const words: WordTiming[] = [
      { id: "w7", text: "one", sep: " ", begin: 30, end: 30.3, joinsNext: false },
      { id: "w8", text: "two", sep: " ", begin: 1, end: 2, joinsNext: false },
      { id: "w9", text: "three", sep: "", begin: 2, end: 3, joinsNext: false },
    ];
    expect(enforceOrderAround(words, 0)).toEqual([
      { text: "one", sep: " ", begin: 30, end: 30.3, joinsNext: false },
      { text: "two", sep: " ", begin: 30.3, end: 30.3, joinsNext: false },
      { text: "three", sep: "", begin: 30.3, end: 30.3, joinsNext: false },
    ]);
  });

  it("stops as soon as the tail is already clear of the anchor", () => {
    const words: WordTiming[] = [
      { id: "w10", text: "one", sep: " ", begin: 0, end: 1.5, joinsNext: false },
      { id: "w11", text: "two", sep: " ", begin: 1, end: 2, joinsNext: false },
      { id: "w12", text: "three", sep: "", begin: 5, end: 6, joinsNext: false },
    ];
    const result = enforceOrderAround(words, 0);
    expect(result[1]).toEqual({ text: "two", sep: " ", begin: 1.5, end: 2, joinsNext: false });
    expect(result[2]).toBe(words[2]);
  });

  describe("edge cases", () => {
    it("returns an empty array unchanged", () => {
      expect(enforceOrderAround([], 0)).toEqual([]);
    });

    it("returns the input when the anchor index is out of range", () => {
      const words: WordTiming[] = [{ id: "w13", text: "one", sep: "", begin: 0, end: 1, joinsNext: false }];
      expect(enforceOrderAround(words, 5)).toBe(words);
    });

    it("is a no-op when the anchor is the last word", () => {
      const words: WordTiming[] = [
        { id: "w14", text: "one", sep: " ", begin: 0, end: 1, joinsNext: false },
        { id: "w15", text: "two", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      expect(enforceOrderAround(words, 1)).toBe(words);
    });

    it("handles a zero-duration anchor", () => {
      const words: WordTiming[] = [
        { id: "w16", text: "one", sep: " ", begin: 5, end: 5, joinsNext: false },
        { id: "w17", text: "two", sep: "", begin: 1, end: 2, joinsNext: false },
      ];
      expect(enforceOrderAround(words, 0)).toEqual([
        { text: "one", sep: " ", begin: 5, end: 5, joinsNext: false },
        { text: "two", sep: "", begin: 5, end: 5, joinsNext: false },
      ]);
    });
  });

  describe("invariants", () => {
    it("never changes the array length", () => {
      const words: WordTiming[] = [
        { id: "w18", text: "one", sep: " ", begin: 30, end: 31, joinsNext: false },
        { id: "w19", text: "two", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w20", text: "three", sep: "", begin: 2, end: 3, joinsNext: false },
      ];
      expect(enforceOrderAround(words, 0)).toHaveLength(3);
    });

    it("does not mutate the input array or its entries", () => {
      const entry: WordTiming = {
        id: "w21",
        text: "two",
        sep: " ",
        begin: 1,
        end: 2,
        explicit: true,
        joinsNext: false,
      };
      const words: WordTiming[] = [{ id: "w22", text: "one", sep: " ", begin: 30, end: 31, joinsNext: false }, entry];
      const snapshot = structuredClone(words);
      enforceOrderAround(words, 0);
      expect(words).toEqual(snapshot);
      expect(entry).toEqual({ text: "two", sep: " ", begin: 1, end: 2, explicit: true, joinsNext: false });
    });

    it("preserves per-word metadata on squeezed words", () => {
      const words: WordTiming[] = [
        { id: "w23", text: "one", sep: " ", begin: 30, end: 31, joinsNext: false },
        { id: "w24", text: "two", sep: "", begin: 1, end: 2, explicit: true, joinsNext: true },
      ];
      const result = enforceOrderAround(words, 0);
      expect(result[1].explicit).toBe(true);
      expect(result[1].joinsNext).toBe(true);
    });

    it("always produces a chronologically ordered array", () => {
      const cases: WordTiming[][] = [
        [
          { id: "w25", text: "a", sep: " ", begin: 9, end: 9, joinsNext: false },
          { id: "w26", text: "b", sep: " ", begin: 0, end: 1, joinsNext: false },
          { id: "w27", text: "c", sep: "", begin: 0.5, end: 0.6, joinsNext: false },
        ],
        [
          { id: "w28", text: "a", sep: " ", begin: 2, end: 4, joinsNext: false },
          { id: "w29", text: "b", sep: " ", begin: 3, end: 3.5, joinsNext: false },
          { id: "w30", text: "c", sep: "", begin: 3.2, end: 8, joinsNext: false },
        ],
        [
          { id: "w31", text: "a", sep: " ", begin: 0, end: 0, joinsNext: false },
          { id: "w32", text: "b", sep: "", begin: 0, end: 0, joinsNext: false },
        ],
      ];
      for (const words of cases) {
        expect(isOrdered(enforceOrderAround(words, 0))).toBe(true);
      }
    });

    it("is idempotent", () => {
      const words: WordTiming[] = [
        { id: "w33", text: "one", sep: " ", begin: 30, end: 31, joinsNext: false },
        { id: "w34", text: "two", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w35", text: "three", sep: "", begin: 2, end: 3, joinsNext: false },
      ];
      const once = enforceOrderAround(words, 0);
      expect(enforceOrderAround(once, 0)).toEqual(once);
    });
  });
});
