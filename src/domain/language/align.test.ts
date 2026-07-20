import { alignTransliterationToWords } from "@/domain/language/align";
import { describe, expect, it } from "vitest";

describe("transliteration alignment", () => {
  it("pairs provider segments with the existing canonical timing slots", () => {
    const words = [
      { text: "今", begin: 1, end: 1.5 },
      { text: "日", begin: 1.5, end: 2 },
    ];
    const result = alignTransliterationToWords(words, [
      { original: "今", transliteration: "kyou" },
      { original: "日", transliteration: "hi" },
    ]);
    expect(result).toEqual([
      { ...words[0], transliteration: "kyou" },
      { ...words[1], transliteration: "hi" },
    ]);
  });

  it("maps spaces to source words without proportional guessing", () => {
    const words = [
      { text: "걸음은 ", begin: 0, end: 0.5 },
      { text: "Like ", begin: 0.5, end: 1 },
      { text: "a ", begin: 1, end: 1.2 },
      { text: "dance", begin: 1.2, end: 2 },
    ];
    expect(
      alignTransliterationToWords(words, [
        { original: "걸음은 Like a dance", transliteration: "geol-eum-eun Like a dance" },
      ]).map((word) => word.transliteration),
    ).toEqual(["geol eum eun", "Like", "a", "dance"]);
  });

  it("maps dash-separated syllables to split timing slots", () => {
    const words = [
      { text: "걸", begin: 0, end: 0.2, syllableGroupId: "g" },
      { text: "음", begin: 0.2, end: 0.4, syllableGroupId: "g" },
      { text: "은 ", begin: 0.4, end: 0.6, syllableGroupId: "g" },
      { text: "Like", begin: 0.6, end: 1 },
    ];
    expect(
      alignTransliterationToWords(words, [{ original: "걸음은 Like", transliteration: "geol-eum-eun Like" }]).map(
        (word) => word.transliteration,
      ),
    ).toEqual(["geol", "eum", "eun", "Like"]);
  });

  it("leaves timing slots untouched when word boundaries do not match", () => {
    const words = [
      { text: "하나 ", begin: 0, end: 0.5 },
      { text: "둘", begin: 0.5, end: 1 },
    ];
    expect(alignTransliterationToWords(words, [{ original: "하나 둘", transliteration: "hana" }])).toEqual(words);
  });

  it("allows one timing slot to carry several lexical word groups", () => {
    const words = [{ text: "걸음은 Like a dance", begin: 0, end: 2 }];
    expect(
      alignTransliterationToWords(words, [
        { original: "걸음은 Like a dance", transliteration: "geol-eum-eun Like a dance" },
      ])[0].transliteration,
    ).toBe("geol eum eun Like a dance");
  });

  it("aligns the timed prefix of a partially synced line", () => {
    const words = [{ text: "걸음은 ", begin: 0, end: 1 }];
    expect(
      alignTransliterationToWords(words, [
        { original: "걸음은 Like a dance", transliteration: "geol-eum-eun Like a dance" },
      ])[0].transliteration,
    ).toBe("geol eum eun");
  });
});
