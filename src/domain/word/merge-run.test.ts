import { newWordId } from "@/domain/word/id";
import { isPartialSyllableRun, isWholeSyllableGroupRun, mergeWordRun, mergeWordText } from "@/domain/word/merge-run";
import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const syl = (text: string, begin: number, end: number, extra: Partial<WordTiming> = {}): WordTiming => ({
  ...wordFromSpaced({ id: newWordId(), text, begin, end }),
  joinsNext: !text.endsWith(" "),
  ...extra,
});

const beautiful = () => [syl("beau", 1, 1.2), syl("ti", 1.2, 1.4), syl("ful ", 1.4, 1.8)];

// -- Tests --------------------------------------------------------------------

describe("mergeWordText", () => {
  it("drops spaces between merged words", () => {
    expect(mergeWordText(["every ", "day"])).toBe("everyday");
    expect(mergeWordText(["a ", "b ", "c"])).toBe("abc");
  });
  it("keeps the final word's trailing space", () => {
    expect(mergeWordText(["every ", "day "])).toBe("everyday ");
  });
});

describe("mergeWordRun", () => {
  it("merges two plain words into one", () => {
    const words = [
      { id: "w3", text: "Hello", sep: " ", begin: 1, end: 1.5, joinsNext: false },
      { id: "w4", text: "world", sep: " ", begin: 1.5, end: 2, joinsNext: false },
    ];
    expect(mergeWordRun(words, [0, 1])).toEqual([{ text: "Helloworld", sep: " ", begin: 1, end: 2, joinsNext: false }]);
  });

  it("merges part of a split word into one syllable that stays in the word", () => {
    expect(mergeWordRun(beautiful(), [1, 2])).toEqual([syl("beau", 1, 1.2), syl("tiful ", 1.2, 1.8)]);
  });

  it("merges a whole split word back into one word", () => {
    expect(mergeWordRun(beautiful(), [0, 1, 2])).toEqual([
      { text: "beautiful", sep: " ", begin: 1, end: 1.8, joinsNext: false },
    ]);
  });

  it("keeps the words outside the run in place", () => {
    const words = [
      { id: "w5", text: "so", sep: " ", begin: 0, end: 1, joinsNext: false },
      { id: "w6", text: "very", sep: " ", begin: 1, end: 2, joinsNext: false },
      ...beautiful().map((w) => ({ ...w, begin: w.begin + 2, end: w.end + 2 })),
    ];
    expect(mergeWordRun(words, [3, 4])).toEqual([
      { text: "so", sep: " ", begin: 0, end: 1, joinsNext: false },
      { text: "very", sep: " ", begin: 1, end: 2, joinsNext: false },
      syl("beau", 3, 3.2),
      syl("tiful ", 3.2, 3.8),
    ]);
  });

  describe("edge cases", () => {
    it("expands a run that crosses into a split word to the whole word", () => {
      const words = [{ id: "w7", text: "so", sep: " ", begin: 0, end: 1, joinsNext: false }, ...beautiful()];
      expect(mergeWordRun(words, [0, 1])).toEqual([
        { text: "sobeautiful", sep: " ", begin: 0, end: 1.8, joinsNext: false },
      ]);
    });

    it("expands by joins, never by trailing spaces", () => {
      const words = [
        { id: "w8", text: "no", sep: "", begin: 0, end: 1, joinsNext: false },
        { id: "w9", text: "space", sep: " ", begin: 1, end: 2, joinsNext: false },
        { id: "w10", text: "here", sep: " ", begin: 2, end: 3, joinsNext: false },
      ];
      expect(mergeWordRun(words, [1, 2])).toEqual([
        { text: "no", sep: "", begin: 0, end: 1, joinsNext: false },
        { text: "spacehere", sep: " ", begin: 1, end: 3, joinsNext: false },
      ]);
    });

    it("returns null for a run shorter than two words", () => {
      expect(mergeWordRun([{ id: "w11", text: "a", sep: "", begin: 0, end: 1, joinsNext: false }], [0])).toBeNull();
    });

    it("returns null for a run outside the words", () => {
      expect(mergeWordRun([{ id: "w12", text: "a", sep: "", begin: 0, end: 1, joinsNext: false }], [3, 4])).toBeNull();
    });
  });

  describe("invariants", () => {
    it("never mutates its input", () => {
      const words = beautiful();
      const copy = structuredClone(words);
      mergeWordRun(words, [1, 2]);
      expect(words).toEqual(copy);
    });

    it("spans exactly from the first begin to the last end of the merged words", () => {
      const merged = mergeWordRun(beautiful(), [0, 1]);
      expect(merged?.[0]).toMatchObject({ begin: 1, end: 1.4 });
      expect(merged?.[1]).toEqual(syl("ful ", 1.4, 1.8));
    });
  });
});

describe("isPartialSyllableRun", () => {
  it("is true only for part of one split word", () => {
    expect(isPartialSyllableRun(beautiful(), [1, 2])).toBe(true);
    expect(isPartialSyllableRun(beautiful(), [0, 1, 2])).toBe(false);
  });

  it("is false for plain words and for a run across two words", () => {
    const words = [{ id: "w13", text: "so", sep: " ", begin: 0, end: 1, joinsNext: false }, ...beautiful()];
    expect(isPartialSyllableRun(words, [0, 1])).toBe(false);
    expect(
      isPartialSyllableRun(
        [
          { id: "w14", text: "a", sep: " ", begin: 0, end: 1, joinsNext: false },
          { id: "w15", text: "b", sep: "", begin: 1, end: 2, joinsNext: false },
        ],
        [0, 1],
      ),
    ).toBe(false);
  });
});

describe("isWholeSyllableGroupRun", () => {
  it("is true only when the run is exactly one split word", () => {
    expect(isWholeSyllableGroupRun(beautiful(), [0, 1, 2])).toBe(true);
    expect(isWholeSyllableGroupRun(beautiful(), [1, 2])).toBe(false);
    expect(
      isWholeSyllableGroupRun(
        [{ id: "w16", text: "so", sep: " ", begin: 0, end: 1, joinsNext: false }, ...beautiful()],
        [0, 1, 2, 3],
      ),
    ).toBe(false);
  });
});
