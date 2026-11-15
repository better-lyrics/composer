import { describe, expect, it } from "vitest";
import { spacedFromWords, wordsFromSpaced } from "@/domain/word/spaced-words";

describe("spaced words", () => {
  it("moves trailing whitespace into sep and back", () => {
    const spaced = [
      { text: "Pa", begin: 1, end: 1.2 },
      { text: "per ", begin: 1.2, end: 1.5 },
      { text: "夜　", begin: 1.6, end: 2, syllableGroupId: "g1" },
      { text: "空  ", begin: 2, end: 2.4, syllableGroupId: "g1" },
      { text: "end", begin: 2.4, end: 3, explicit: true as const },
    ];
    const words = wordsFromSpaced(spaced);
    expect(words.map((word) => [word.text, word.sep])).toEqual([
      ["Pa", ""],
      ["per", " "],
      ["夜", "　"],
      ["空", "  "],
      ["end", ""],
    ]);
    expect(words.every((word) => word.text === word.text.trimEnd())).toBe(true);
    expect(spacedFromWords(words)).toEqual(spaced);
  });

  it("never writes ids into saved words", () => {
    const words = wordsFromSpaced([
      { text: "Paper ", begin: 1, end: 2 },
      { text: "lanterns", begin: 2, end: 3 },
    ]);
    expect(words.every((word) => word.id.length > 0)).toBe(true);
    expect(spacedFromWords(words).some((word) => "id" in word)).toBe(false);
  });
});
