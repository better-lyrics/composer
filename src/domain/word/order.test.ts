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
      { id: "w1", text: "one", sep: " ", begin: 0, end: 1 },
      { id: "w2", text: "two", sep: " ", begin: 1, end: 2 },
      { id: "w3", text: "three", sep: "", begin: 2, end: 3 },
    ];
    expect(enforceOrderAround(words, 0)).toBe(words);
  });

  it("squeezes a single overlapping successor forward", () => {
    const words: WordTiming[] = [
      { id: "w4", text: "one", sep: " ", begin: 0.5, end: 0.8 },
      { id: "w5", text: "two", sep: " ", begin: 0.4, end: 0.8 },
      { id: "w6", text: "three", sep: "", begin: 0.8, end: 1.2 },
    ];
    expect(enforceOrderAround(words, 0)).toEqual([
      { text: "one", sep: " ", begin: 0.5, end: 0.8 },
      { text: "two", sep: " ", begin: 0.8, end: 0.8 },
      { text: "three", sep: "", begin: 0.8, end: 1.2 },
    ]);
  });

  it("cascades when the anchor lands past the whole tail", () => {
    const words: WordTiming[] = [
      { id: "w7", text: "one", sep: " ", begin: 30, end: 30.3 },
      { id: "w8", text: "two", sep: " ", begin: 1, end: 2 },
      { id: "w9", text: "three", sep: "", begin: 2, end: 3 },
    ];
    expect(enforceOrderAround(words, 0)).toEqual([
      { text: "one", sep: " ", begin: 30, end: 30.3 },
      { text: "two", sep: " ", begin: 30.3, end: 30.3 },
      { text: "three", sep: "", begin: 30.3, end: 30.3 },
    ]);
  });

  it("stops as soon as the tail is already clear of the anchor", () => {
    const words: WordTiming[] = [
      { id: "w10", text: "one", sep: " ", begin: 0, end: 1.5 },
      { id: "w11", text: "two", sep: " ", begin: 1, end: 2 },
      { id: "w12", text: "three", sep: "", begin: 5, end: 6 },
    ];
    const result = enforceOrderAround(words, 0);
    expect(result[1]).toEqual({ text: "two", sep: " ", begin: 1.5, end: 2 });
    expect(result[2]).toBe(words[2]);
  });

  describe("edge cases", () => {
    it("returns an empty array unchanged", () => {
      expect(enforceOrderAround([], 0)).toEqual([]);
    });

    it("returns the input when the anchor index is out of range", () => {
      const words: WordTiming[] = [{ id: "w13", text: "one", sep: "", begin: 0, end: 1 }];
      expect(enforceOrderAround(words, 5)).toBe(words);
    });

    it("is a no-op when the anchor is the last word", () => {
      const words: WordTiming[] = [
        { id: "w14", text: "one", sep: " ", begin: 0, end: 1 },
        { id: "w15", text: "two", sep: "", begin: 1, end: 2 },
      ];
      expect(enforceOrderAround(words, 1)).toBe(words);
    });

    it("handles a zero-duration anchor", () => {
      const words: WordTiming[] = [
        { id: "w16", text: "one", sep: " ", begin: 5, end: 5 },
        { id: "w17", text: "two", sep: "", begin: 1, end: 2 },
      ];
      expect(enforceOrderAround(words, 0)).toEqual([
        { text: "one", sep: " ", begin: 5, end: 5 },
        { text: "two", sep: "", begin: 5, end: 5 },
      ]);
    });
  });

  describe("invariants", () => {
    it("never changes the array length", () => {
      const words: WordTiming[] = [
        { id: "w18", text: "one", sep: " ", begin: 30, end: 31 },
        { id: "w19", text: "two", sep: " ", begin: 1, end: 2 },
        { id: "w20", text: "three", sep: "", begin: 2, end: 3 },
      ];
      expect(enforceOrderAround(words, 0)).toHaveLength(3);
    });

    it("does not mutate the input array or its entries", () => {
      const entry: WordTiming = { id: "w21", text: "two", sep: " ", begin: 1, end: 2, explicit: true };
      const words: WordTiming[] = [{ id: "w22", text: "one", sep: " ", begin: 30, end: 31 }, entry];
      const snapshot = structuredClone(words);
      enforceOrderAround(words, 0);
      expect(words).toEqual(snapshot);
      expect(entry).toEqual({ text: "two", sep: " ", begin: 1, end: 2, explicit: true });
    });

    it("preserves per-word metadata on squeezed words", () => {
      const words: WordTiming[] = [
        { id: "w23", text: "one", sep: " ", begin: 30, end: 31 },
        { id: "w24", text: "two", sep: "", begin: 1, end: 2, explicit: true, syllableGroupId: "g1" },
      ];
      const result = enforceOrderAround(words, 0);
      expect(result[1].explicit).toBe(true);
      expect(result[1].syllableGroupId).toBe("g1");
    });

    it("always produces a chronologically ordered array", () => {
      const cases: WordTiming[][] = [
        [
          { id: "w25", text: "a", sep: " ", begin: 9, end: 9 },
          { id: "w26", text: "b", sep: " ", begin: 0, end: 1 },
          { id: "w27", text: "c", sep: "", begin: 0.5, end: 0.6 },
        ],
        [
          { id: "w28", text: "a", sep: " ", begin: 2, end: 4 },
          { id: "w29", text: "b", sep: " ", begin: 3, end: 3.5 },
          { id: "w30", text: "c", sep: "", begin: 3.2, end: 8 },
        ],
        [
          { id: "w31", text: "a", sep: " ", begin: 0, end: 0 },
          { id: "w32", text: "b", sep: "", begin: 0, end: 0 },
        ],
      ];
      for (const words of cases) {
        expect(isOrdered(enforceOrderAround(words, 0))).toBe(true);
      }
    });

    it("is idempotent", () => {
      const words: WordTiming[] = [
        { id: "w33", text: "one", sep: " ", begin: 30, end: 31 },
        { id: "w34", text: "two", sep: " ", begin: 1, end: 2 },
        { id: "w35", text: "three", sep: "", begin: 2, end: 3 },
      ];
      const once = enforceOrderAround(words, 0);
      expect(enforceOrderAround(once, 0)).toEqual(once);
    });
  });
});
