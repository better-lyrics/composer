import {
  isPartialSyllableRun,
  isWholeSyllableGroupRun,
  mergeWordRun,
  mergeWordText,
  mergedTransliteration,
} from "@/domain/word/merge-run";
import type { WordTiming } from "@/domain/word/timing";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const syl = (text: string, begin: number, end: number, extra: Partial<WordTiming> = {}): WordTiming => ({
  text,
  begin,
  end,
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
        { text: "a", begin: 0, end: 1, transliteration: "ka", transliterationJoinerAfter: "-" },
        { text: "b", begin: 1, end: 2, transliteration: "na" },
      ]),
    ).toBe("ka-na");
  });
});

describe("mergeWordRun", () => {
  it("merges two plain words into one", () => {
    const words = [
      { text: "Hello ", begin: 1, end: 1.5 },
      { text: "world ", begin: 1.5, end: 2 },
    ];
    expect(mergeWordRun(words, [0, 1])).toEqual([{ text: "Helloworld ", begin: 1, end: 2 }]);
  });

  it("merges part of a split word into one syllable that stays in the word", () => {
    expect(mergeWordRun(beautiful(), [1, 2])).toEqual([syl("beau", 1, 1.2), syl("tiful ", 1.2, 1.8)]);
  });

  it("merges a whole split word back into one word", () => {
    expect(mergeWordRun(beautiful(), [0, 1, 2])).toEqual([{ text: "beautiful ", begin: 1, end: 1.8 }]);
  });

  it("keeps the words outside the run in place", () => {
    const words = [
      { text: "so ", begin: 0, end: 1 },
      { text: "very ", begin: 1, end: 2 },
      ...beautiful().map((w) => ({ ...w, begin: w.begin + 2, end: w.end + 2 })),
    ];
    expect(mergeWordRun(words, [3, 4])).toEqual([
      { text: "so ", begin: 0, end: 1 },
      { text: "very ", begin: 1, end: 2 },
      syl("beau", 3, 3.2),
      syl("tiful ", 3.2, 3.8),
    ]);
  });

  describe("edge cases", () => {
    it("expands a run that crosses into a split word to the whole word", () => {
      const words = [{ text: "so ", begin: 0, end: 1 }, ...beautiful()];
      expect(mergeWordRun(words, [0, 1])).toEqual([{ text: "sobeautiful ", begin: 0, end: 1.8 }]);
    });

    it("expands by syllable group id, never by trailing spaces", () => {
      const words = [
        { text: "no", begin: 0, end: 1 },
        { text: "space ", begin: 1, end: 2 },
        { text: "here ", begin: 2, end: 3 },
      ];
      expect(mergeWordRun(words, [1, 2])).toEqual([
        { text: "no", begin: 0, end: 1 },
        { text: "spacehere ", begin: 1, end: 3 },
      ]);
    });

    it("returns null for a run shorter than two words", () => {
      expect(mergeWordRun([{ text: "a", begin: 0, end: 1 }], [0])).toBeNull();
    });

    it("returns null for a run outside the words", () => {
      expect(mergeWordRun([{ text: "a", begin: 0, end: 1 }], [3, 4])).toBeNull();
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
    const words = [{ text: "so ", begin: 0, end: 1 }, ...beautiful()];
    expect(isPartialSyllableRun(words, [0, 1])).toBe(false);
    expect(
      isPartialSyllableRun(
        [
          { text: "a ", begin: 0, end: 1 },
          { text: "b", begin: 1, end: 2 },
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
    expect(isWholeSyllableGroupRun([{ text: "so ", begin: 0, end: 1 }, ...beautiful()], [0, 1, 2, 3])).toBe(false);
  });
});
