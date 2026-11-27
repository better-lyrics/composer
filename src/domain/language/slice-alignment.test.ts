import { alignTransliterationToSlices } from "@/domain/language/slice-alignment";
import { describe, expect, it } from "vitest";

const WORDS = [
  { text: "水溜りに", begin: 21.041, end: 21.76 },
  { text: "足を", begin: 21.76, end: 22.308 },
  { text: "突っ込ん", begin: 22.308, end: 22.952 },
  { text: "で", begin: 22.952, end: 23.701 },
];

describe("alignTransliterationToSlices", () => {
  it("maps one slice to each timed syllable and keeps the separators as joiners", () => {
    const result = alignTransliterationToSlices(WORDS, "Mizu tamari ni  ashi o  tsukkonde", [
      "Mizu tamari ni",
      "ashi o",
      "tsukkon",
      "de",
    ]);
    if ("error" in result) throw new Error(result.error);
    expect(result.words.map((word) => word.transliteration)).toEqual(["Mizu tamari ni", "ashi o", "tsukkon", "de"]);
    expect(result.words.slice(0, -1).map((word) => word.transliterationJoinerAfter)).toEqual(["  ", "  ", ""]);
    expect(result.words.map(({ text, begin, end }) => ({ text, begin, end }))).toEqual(WORDS);
  });

  it("refuses slices that do not spell the reading or do not match the syllable count", () => {
    expect(
      alignTransliterationToSlices(WORDS, "Mizu tamari ni ashi o tsukkonde", ["Mizu tamari ni", "ashi o", "tsukkonde"]),
    ).toMatchObject({ error: expect.stringContaining("4") });
    expect(
      alignTransliterationToSlices(WORDS, "Mizu tamari ni ashi o tsukkonde", [
        "Mizu tamari",
        "ni ashi",
        "o",
        "tsukonde",
      ]),
    ).toMatchObject({ error: expect.stringContaining("Mizu tamari ni ashi o tsukkonde") });
  });
});
