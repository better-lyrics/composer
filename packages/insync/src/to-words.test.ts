import { describe, expect, it } from "vitest";
import { syllablesFromWords } from "./from-words";
import type { Ms } from "./time";
import { wordsFromSyllables } from "./to-words";

describe("wordsFromSyllables", () => {
  it("restores word text and timing exactly", () => {
    const words = [
      { text: "Pa", begin: 12.4, end: 12.62 },
      { text: "per ", begin: 12.62, end: 12.95 },
      { text: "夜　", begin: 13, end: 13.5 },
      { text: "far away", begin: 14.3, end: 15.4 },
    ];
    const restored = wordsFromSyllables(syllablesFromWords(words));
    expect(restored.map(({ text, begin, end }) => ({ text, begin, end }))).toEqual(words);
  });

  it("keeps word boundaries through a round trip", () => {
    const track = syllablesFromWords([
      { text: "夜", begin: 1, end: 1.4, syllableGroupId: "a" },
      { text: "空", begin: 1.4, end: 1.8, syllableGroupId: "a" },
      { text: "星", begin: 1.8, end: 2.2, syllableGroupId: "b" },
    ]);
    const again = syllablesFromWords(wordsFromSyllables(track));
    expect(again.map((syllable) => syllable.joinsNext)).toEqual([true, false, false]);
  });

  it("skips untimed syllables, which today's words cannot hold", () => {
    const words = wordsFromSyllables([
      { text: "Pa", sep: "", joinsNext: true, span: [1000 as Ms, 1200 as Ms] },
      { text: "per", sep: " ", joinsNext: false },
    ]);
    expect(words).toEqual([{ text: "Pa", begin: 1, end: 1.2, syllableGroupId: "w0" }]);
  });
});
