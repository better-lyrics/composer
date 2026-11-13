import { newWordId } from "@/domain/word/id";
import {
  copyMergeCover,
  isPartialSyllableRun,
  isWholeSyllableGroupRun,
  mergeWordRun,
  mergeWordText,
  mergedTransliteration,
} from "@/domain/word/merge-run";
import { wordFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const syl = (text: string, begin: number, end: number, extra: Partial<WordTiming> = {}): WordTiming => ({
  ...wordFromSpaced({ id: newWordId(), text, begin, end }),
  syllableGroupId: "g",
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

describe("mergedTransliteration", () => {
  it("joins the pieces with the joiner stored after each piece", () => {
    expect(
      mergedTransliteration([
        { id: "w1", text: "a", sep: "", begin: 0, end: 1, transliteration: "ka", transliterationJoinerAfter: "-" },
        { id: "w2", text: "b", sep: "", begin: 1, end: 2, transliteration: "na" },
      ]),
    ).toBe("ka-na");
  });
});

describe("mergeWordRun", () => {
  it("merges two plain words into one", () => {
    const words = [
      { id: "w3", text: "Hello", sep: " ", begin: 1, end: 1.5 },
      { id: "w4", text: "world", sep: " ", begin: 1.5, end: 2 },
    ];
    expect(mergeWordRun(words, [0, 1])).toEqual([{ text: "Helloworld", sep: " ", begin: 1, end: 2 }]);
  });

  it("merges part of a split word into one syllable that stays in the word", () => {
    expect(mergeWordRun(beautiful(), [1, 2])).toEqual([syl("beau", 1, 1.2), syl("tiful ", 1.2, 1.8)]);
  });

  it("merges a whole split word back into one word", () => {
    expect(mergeWordRun(beautiful(), [0, 1, 2])).toEqual([{ text: "beautiful", sep: " ", begin: 1, end: 1.8 }]);
  });

  it("keeps the words outside the run in place", () => {
    const words = [
      { id: "w5", text: "so", sep: " ", begin: 0, end: 1 },
      { id: "w6", text: "very", sep: " ", begin: 1, end: 2 },
      ...beautiful().map((w) => ({ ...w, begin: w.begin + 2, end: w.end + 2 })),
    ];
    expect(mergeWordRun(words, [3, 4])).toEqual([
      { text: "so", sep: " ", begin: 0, end: 1 },
      { text: "very", sep: " ", begin: 1, end: 2 },
      syl("beau", 3, 3.2),
      syl("tiful ", 3.2, 3.8),
    ]);
  });

  describe("edge cases", () => {
    it("expands a run that crosses into a split word to the whole word", () => {
      const words = [{ id: "w7", text: "so", sep: " ", begin: 0, end: 1 }, ...beautiful()];
      expect(mergeWordRun(words, [0, 1])).toEqual([{ text: "sobeautiful", sep: " ", begin: 0, end: 1.8 }]);
    });

    it("expands by syllable group id, never by trailing spaces", () => {
      const words = [
        { id: "w8", text: "no", sep: "", begin: 0, end: 1 },
        { id: "w9", text: "space", sep: " ", begin: 1, end: 2 },
        { id: "w10", text: "here", sep: " ", begin: 2, end: 3 },
      ];
      expect(mergeWordRun(words, [1, 2])).toEqual([
        { text: "no", sep: "", begin: 0, end: 1 },
        { text: "spacehere", sep: " ", begin: 1, end: 3 },
      ]);
    });

    it("returns null for a run shorter than two words", () => {
      expect(mergeWordRun([{ id: "w11", text: "a", sep: "", begin: 0, end: 1 }], [0])).toBeNull();
    });

    it("returns null for a run outside the words", () => {
      expect(mergeWordRun([{ id: "w12", text: "a", sep: "", begin: 0, end: 1 }], [3, 4])).toBeNull();
    });
  });

  describe("transliteration", () => {
    it("joins the pieces with the joiners between them", () => {
      const words = [
        syl("a", 0, 1, { transliteration: "a", transliterationJoinerAfter: "" }),
        syl("b", 1, 2, { transliteration: "bi", transliterationJoinerAfter: "-" }),
        syl("c ", 2, 3, { transliteration: "si" }),
      ];
      expect(mergeWordRun(words, [0, 1])?.[0]).toMatchObject({
        transliteration: "abi",
        transliterationJoinerAfter: "-",
        syllableGroupId: "g",
      });
    });

    it("drops the transliteration when one piece is missing", () => {
      const words = [syl("a", 0, 1, { transliteration: "a" }), syl("b ", 1, 2)];
      expect(mergeWordRun(words, [0, 1])?.[0].transliteration).toBeUndefined();
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
    const words = [{ id: "w13", text: "so", sep: " ", begin: 0, end: 1 }, ...beautiful()];
    expect(isPartialSyllableRun(words, [0, 1])).toBe(false);
    expect(
      isPartialSyllableRun(
        [
          { id: "w14", text: "a", sep: " ", begin: 0, end: 1 },
          { id: "w15", text: "b", sep: "", begin: 1, end: 2 },
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
      isWholeSyllableGroupRun([{ id: "w16", text: "so", sep: " ", begin: 0, end: 1 }, ...beautiful()], [0, 1, 2, 3]),
    ).toBe(false);
  });
});

describe("copyMergeCover", () => {
  const source: WordTiming[] = [
    { id: "w17", text: "one", sep: " ", begin: 0, end: 1 },
    { id: "w18", text: "two", sep: " ", begin: 1, end: 2 },
    { id: "w19", text: "three", sep: "", begin: 2, end: 3 },
  ];

  it("maps a run onto a copy split the same way", () => {
    expect(copyMergeCover(source, [0, 1], source)).toEqual({ inside: [0, 1], overlapping: [0, 1] });
  });

  it("maps a run onto every word of a copy that covers the same text", () => {
    const copy: WordTiming[] = [
      { id: "w20", text: "o", sep: "", begin: 10, end: 10.4 },
      { id: "w21", text: "ne", sep: " ", begin: 10.4, end: 11 },
      { id: "w22", text: "two", sep: " ", begin: 11, end: 12 },
      { id: "w23", text: "three", sep: "", begin: 12, end: 13 },
    ];
    expect(copyMergeCover(source, [0, 1], copy)).toEqual({ inside: [0, 1, 2], overlapping: [0, 1, 2] });
  });

  it("regression: maps the run after it grows to the whole split word", () => {
    const grouped: WordTiming[] = [
      { id: "w24", text: "so", sep: " ", begin: 0, end: 1 },
      { id: "w25", text: "beau", sep: "", begin: 1, end: 1.2, syllableGroupId: "g" },
      { id: "w26", text: "ti", sep: "", begin: 1.2, end: 1.4, syllableGroupId: "g" },
      { id: "w27", text: "ful", sep: "", begin: 1.4, end: 1.8, syllableGroupId: "g" },
    ];
    const copy: WordTiming[] = [
      { id: "w28", text: "so", sep: " ", begin: 10, end: 11 },
      { id: "w29", text: "be", sep: "", begin: 11, end: 11.1 },
      { id: "w30", text: "au", sep: "", begin: 11.1, end: 11.2 },
      { id: "w31", text: "ti", sep: "", begin: 11.2, end: 11.4 },
      { id: "w32", text: "ful", sep: "", begin: 11.4, end: 11.8 },
    ];
    expect(copyMergeCover(grouped, [0, 1], copy).inside).toEqual([0, 1, 2, 3, 4]);
  });

  it("regression: reports a copy whose blocks cross the merged text", () => {
    const grouped: WordTiming[] = [
      { id: "w33", text: "beau", sep: "", begin: 0, end: 0.3, syllableGroupId: "g" },
      { id: "w34", text: "ti", sep: "", begin: 0.3, end: 0.6, syllableGroupId: "g" },
      { id: "w35", text: "ful", sep: "", begin: 0.6, end: 0.9, syllableGroupId: "g" },
    ];
    const copy: WordTiming[] = [
      { id: "w36", text: "be", sep: "", begin: 10, end: 10.2, syllableGroupId: "h" },
      { id: "w37", text: "aut", sep: "", begin: 10.2, end: 10.5, syllableGroupId: "h" },
      { id: "w38", text: "iful", sep: "", begin: 10.5, end: 10.9, syllableGroupId: "h" },
    ];
    expect(copyMergeCover(grouped, [0, 1], copy)).toEqual({ inside: [0, 1], overlapping: [0, 1, 2] });
  });

  describe("edge cases", () => {
    it("returns no indices when the copy has not reached the run yet", () => {
      expect(copyMergeCover(source, [1, 2], [{ id: "w1", text: "one", sep: " ", begin: 0, end: 1 }])).toEqual({
        inside: [],
        overlapping: [],
      });
    });
  });
});
