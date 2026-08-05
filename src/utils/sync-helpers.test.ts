import type { WordTiming } from "@/domain/word/timing";
import { closeHeldWord, commitHeldWord, commitTappedWord } from "@/utils/sync-helpers";
import { describe, expect, it } from "vitest";

// -- commitTappedWord ---------------------------------------------------------

describe("commitTappedWord", () => {
  it("returns a single new word when there are no existing words", () => {
    const result = commitTappedWord([], 0, "hello", 5, 6);
    expect(result).toEqual([{ text: "hello", begin: 5, end: 6 }]);
  });

  it("returns a single new word when there are no existing words and wordIndex is non-zero", () => {
    const result = commitTappedWord([], 2, "hello", 5, 6);
    expect(result).toEqual([{ text: "hello", begin: 5, end: 6 }]);
  });

  it("redo at wordIndex 0 overwrites the first word in place and keeps later words", () => {
    const existing: WordTiming[] = [
      { text: "one ", begin: 0, end: 1 },
      { text: "two", begin: 1, end: 2 },
    ];
    const result = commitTappedWord(existing, 0, "ONE", 0.2, 0.8);
    expect(result).toEqual([
      { text: "ONE", begin: 0.2, end: 0.8 },
      { text: "two", begin: 1, end: 2 },
    ]);
  });

  it("re-syncs from the middle: overwrites in place, closes the prior word, and preserves later words", () => {
    const existing: WordTiming[] = [
      { text: "one ", begin: 0, end: 1 },
      { text: "two ", begin: 1, end: 2 },
      { text: "three", begin: 2, end: 3 },
    ];
    const result = commitTappedWord(existing, 1, "TWO", 1.2, 1.8);
    expect(result).toEqual([
      { text: "one ", begin: 0, end: 1.2 },
      { text: "TWO", begin: 1.2, end: 1.8 },
      { text: "three", begin: 2, end: 3 },
    ]);
  });

  it("squeezes later words forward when the redo lands past them", () => {
    const existing: WordTiming[] = [
      { text: "one ", begin: 0, end: 1 },
      { text: "two ", begin: 1, end: 2 },
      { text: "three", begin: 2, end: 3 },
    ];
    const result = commitTappedWord(existing, 1, "TWO", 5, 6);
    expect(result).toEqual([
      { text: "one ", begin: 0, end: 5 },
      { text: "TWO", begin: 5, end: 6 },
      { text: "three", begin: 6, end: 6 },
    ]);
  });

  it("forward tap at the end: closes the prior word and appends", () => {
    const existing: WordTiming[] = [{ text: "one ", begin: 0, end: 1 }];
    const result = commitTappedWord(existing, 1, "two", 5, 6);
    expect(result).toEqual([
      { text: "one ", begin: 0, end: 5 },
      { text: "two", begin: 5, end: 6 },
    ]);
  });

  it("drifted cursor (wordIndex past existing length) clamps to length and appends without holes", () => {
    const existing: WordTiming[] = [{ text: "one ", begin: 0, end: 1 }];
    const result = commitTappedWord(existing, 4, "two", 5, 6);
    expect(result).toHaveLength(2);
    for (const w of result) {
      expect(typeof w.text).toBe("string");
      expect(typeof w.begin).toBe("number");
      expect(typeof w.end).toBe("number");
    }
    expect(result[0]).toEqual({ text: "one ", begin: 0, end: 5 });
    expect(result[1]).toEqual({ text: "two", begin: 5, end: 6 });
  });

  it("drifted cursor result has no sparse holes", () => {
    const existing: WordTiming[] = [{ text: "one ", begin: 0, end: 1 }];
    const result = commitTappedWord(existing, 5, "next", 10, 11);
    expect(Object.keys(result).length).toBe(result.length);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeDefined();
    }
  });

  describe("invariants", () => {
    it("regression: a redo never leaves the line ending before it begins", () => {
      const existing: WordTiming[] = [
        { text: "Tercero ", begin: 0.508, end: 1.106 },
        { text: "line ", begin: 1.106, end: 1.508 },
        { text: "song", begin: 2.502, end: 2.897 },
      ];
      const result = commitTappedWord(existing, 0, "Tercero ", 2.916, 3.216);
      expect(result[0].begin).toBeLessThanOrEqual(result[result.length - 1].end);
    });

    it("keeps every word chronologically ordered whatever the redo time", () => {
      const existing: WordTiming[] = [
        { text: "one ", begin: 0, end: 1 },
        { text: "two ", begin: 1, end: 2 },
        { text: "three", begin: 2, end: 3 },
      ];
      for (const wordIndex of [0, 1, 2]) {
        for (const begin of [0, 0.5, 1.5, 2.5, 10]) {
          const result = commitTappedWord(existing, wordIndex, "X", begin, begin + 0.3);
          for (let i = 0; i < result.length; i++) {
            expect(result[i].end).toBeGreaterThanOrEqual(result[i].begin);
            if (i > 0) expect(result[i].begin).toBeGreaterThanOrEqual(result[i - 1].end);
          }
        }
      }
    });

    it("does not mutate the input array or its entries", () => {
      const entry: WordTiming = { text: "two ", begin: 1, end: 2, explicit: true };
      const existing: WordTiming[] = [{ text: "one ", begin: 0, end: 1 }, entry];
      const snapshot = structuredClone(existing);
      commitTappedWord(existing, 0, "ONE", 5, 6);
      expect(existing).toEqual(snapshot);
      expect(entry).toEqual({ text: "two ", begin: 1, end: 2, explicit: true });
    });
  });
});

// -- commitHeldWord -----------------------------------------------------------

describe("commitHeldWord", () => {
  it("returns a single new word when there are no existing words", () => {
    const result = commitHeldWord([], 0, "hello", 5);
    expect(result).toEqual([{ text: "hello", begin: 5, end: 5 }]);
  });

  it("opens the first word at the held time without leaving it ending before it begins", () => {
    const existing: WordTiming[] = [{ text: "one ", begin: 0, end: 1 }];
    const result = commitHeldWord(existing, 0, "ONE", 5);
    expect(result).toEqual([{ text: "ONE", begin: 5, end: 5 }]);
  });

  it("redo at a mid-line word overwrites it in place and preserves later words", () => {
    const existing: WordTiming[] = [
      { text: "one ", begin: 0, end: 1 },
      { text: "two ", begin: 1, end: 2 },
      { text: "three", begin: 2, end: 3 },
    ];
    const result = commitHeldWord(existing, 1, "TWO", 1.5);
    expect(result).toEqual([
      { text: "one ", begin: 0, end: 1 },
      { text: "TWO", begin: 1.5, end: 1.5 },
      { text: "three", begin: 2, end: 3 },
    ]);
  });

  it("squeezes later words forward when the held word lands past them", () => {
    const existing: WordTiming[] = [
      { text: "one ", begin: 0, end: 1 },
      { text: "two ", begin: 1, end: 2 },
      { text: "three", begin: 2, end: 3 },
    ];
    const result = commitHeldWord(existing, 1, "TWO", 5);
    expect(result).toEqual([
      { text: "one ", begin: 0, end: 1 },
      { text: "TWO", begin: 5, end: 5 },
      { text: "three", begin: 5, end: 5 },
    ]);
  });

  it("forward hold at the end: appends a held word without closing prior word's end", () => {
    const existing: WordTiming[] = [{ text: "one ", begin: 0, end: 1 }];
    const result = commitHeldWord(existing, 1, "two", 5);
    expect(result).toEqual([
      { text: "one ", begin: 0, end: 1 },
      { text: "two", begin: 5, end: 5 },
    ]);
  });

  it("drifted cursor (wordIndex past existing length) clamps and appends without holes", () => {
    const existing: WordTiming[] = [{ text: "one ", begin: 0, end: 1 }];
    const result = commitHeldWord(existing, 4, "two", 5);
    expect(result).toHaveLength(2);
    for (const w of result) {
      expect(typeof w.text).toBe("string");
    }
    expect(result[0]).toEqual({ text: "one ", begin: 0, end: 1 });
    expect(result[1]).toEqual({ text: "two", begin: 5, end: 5 });
  });

  describe("regressions", () => {
    it("regression: preserves explicit and syllableGroupId when re-holding a mid-line word", () => {
      const existing: WordTiming[] = [
        { text: "one ", begin: 0, end: 1 },
        { text: "two ", begin: 1, end: 2 },
        { text: "three", begin: 2, end: 3, explicit: true, syllableGroupId: "g1" },
      ];
      const result = commitHeldWord(existing, 2, "three", 5);
      expect(result[2].explicit).toBe(true);
      expect(result[2].syllableGroupId).toBe("g1");
    });

    it("regression: hold and tap agree on which metadata survives a mid-line redo", () => {
      const existing: WordTiming[] = [
        { text: "one ", begin: 0, end: 1 },
        { text: "two ", begin: 1, end: 2, explicit: true, syllableGroupId: "g1" },
      ];
      const held = commitHeldWord(existing, 1, "two ", 5);
      const tapped = commitTappedWord(existing, 1, "two ", 5, 6);
      expect(held[1].explicit).toBe(tapped[1].explicit);
      expect(held[1].syllableGroupId).toBe(tapped[1].syllableGroupId);
    });
  });

  describe("invariants", () => {
    it("does not mutate the input array or its entries", () => {
      const entry: WordTiming = { text: "two ", begin: 1, end: 2, explicit: true };
      const existing: WordTiming[] = [{ text: "one ", begin: 0, end: 1 }, entry];
      const snapshot = structuredClone(existing);
      commitHeldWord(existing, 1, "TWO", 5);
      expect(existing).toEqual(snapshot);
      expect(entry).toEqual({ text: "two ", begin: 1, end: 2, explicit: true });
    });

    it("never changes the array length when overwriting an existing word", () => {
      const existing: WordTiming[] = [
        { text: "one ", begin: 0, end: 1 },
        { text: "two ", begin: 1, end: 2 },
        { text: "three", begin: 2, end: 3 },
      ];
      expect(commitHeldWord(existing, 1, "TWO", 5)).toHaveLength(3);
    });
  });
});

// -- closeHeldWord ------------------------------------------------------------

describe("closeHeldWord", () => {
  it("closes the word at wordIndex, not the last word", () => {
    const existing: WordTiming[] = [
      { text: "one ", begin: 0, end: 1 },
      { text: "two ", begin: 1, end: 1 },
      { text: "three", begin: 3, end: 4 },
    ];
    const result = closeHeldWord(existing, 1, 2);
    expect(result[1]).toEqual({ text: "two ", begin: 1, end: 2 });
    expect(result[2]).toEqual({ text: "three", begin: 3, end: 4 });
  });

  it("squeezes later words forward when the closed word overruns them", () => {
    const existing: WordTiming[] = [
      { text: "one ", begin: 0, end: 1 },
      { text: "two ", begin: 1, end: 1 },
      { text: "three", begin: 3, end: 4 },
    ];
    const result = closeHeldWord(existing, 1, 5);
    expect(result).toEqual([
      { text: "one ", begin: 0, end: 1 },
      { text: "two ", begin: 1, end: 5 },
      { text: "three", begin: 5, end: 5 },
    ]);
  });

  it("preserves explicit and syllableGroupId on the closed word", () => {
    const existing: WordTiming[] = [{ text: "one ", begin: 5, end: 5, explicit: true, syllableGroupId: "g1" }];
    const result = closeHeldWord(existing, 0, 6);
    expect(result[0]).toEqual({ text: "one ", begin: 5, end: 6, explicit: true, syllableGroupId: "g1" });
  });

  describe("edge cases", () => {
    it("returns an empty array unchanged", () => {
      expect(closeHeldWord([], 0, 6)).toEqual([]);
    });

    it("clamps a cursor past the end onto the last word", () => {
      const existing: WordTiming[] = [
        { text: "one ", begin: 0, end: 1 },
        { text: "two ", begin: 5, end: 5 },
      ];
      const result = closeHeldWord(existing, 9, 6);
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({ text: "two ", begin: 5, end: 6 });
    });

    it("clamps a negative cursor onto the first word", () => {
      const existing: WordTiming[] = [{ text: "one ", begin: 5, end: 5 }];
      const result = closeHeldWord(existing, -1, 6);
      expect(result[0]).toEqual({ text: "one ", begin: 5, end: 6 });
    });
  });

  describe("invariants", () => {
    it("does not mutate the input array or its entries", () => {
      const entry: WordTiming = { text: "two ", begin: 5, end: 5 };
      const existing: WordTiming[] = [{ text: "one ", begin: 0, end: 1 }, entry];
      const snapshot = structuredClone(existing);
      closeHeldWord(existing, 1, 6);
      expect(existing).toEqual(snapshot);
      expect(entry).toEqual({ text: "two ", begin: 5, end: 5 });
    });

    it("is idempotent for the same end value", () => {
      const existing: WordTiming[] = [{ text: "one ", begin: 5, end: 5 }];
      const once = closeHeldWord(existing, 0, 6);
      expect(closeHeldWord(once, 0, 6)).toEqual(once);
    });

    it("leaves every word other than the closed one untouched", () => {
      const existing: WordTiming[] = [
        { text: "one ", begin: 0, end: 1 },
        { text: "two ", begin: 1, end: 1 },
        { text: "three", begin: 3, end: 4 },
      ];
      const result = closeHeldWord(existing, 1, 2);
      expect(result[0]).toBe(existing[0]);
      expect(result[2]).toBe(existing[2]);
    });
  });
});
