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
    expect(spacedFromWords(words).map(({ syllableGroupId: _id, ...word }) => word)).toEqual(
      spaced.map(({ syllableGroupId: _id, ...word }) => word),
    );
  });

  it("reads joins from ids when a track has them, else from spacing", () => {
    const byIds = wordsFromSpaced([
      { text: "glow", begin: 1, end: 1.2, syllableGroupId: "a" },
      { text: "ing ", begin: 1.2, end: 1.5, syllableGroupId: "a" },
      { text: "night", begin: 1.6, end: 2 },
    ]);
    expect(byIds.map((word) => word.joinsNext)).toEqual([true, false, false]);
    expect(byIds.some((word) => "syllableGroupId" in word)).toBe(false);
    const bySpacing = wordsFromSpaced([
      { text: "Pa", begin: 1, end: 1.2 },
      { text: "per ", begin: 1.2, end: 1.5 },
      { text: "boats", begin: 1.6, end: 2 },
    ]);
    expect(bySpacing.map((word) => word.joinsNext)).toEqual([true, false, false]);
  });

  it("round trip keeps joinsNext exactly, whatever the spacing", () => {
    const words = wordsFromSpaced([
      { text: "far ", begin: 1, end: 1.2, syllableGroupId: "x" },
      { text: "away", begin: 1.2, end: 1.5, syllableGroupId: "x" },
      { text: "夜", begin: 1.6, end: 2 },
      { text: "空", begin: 2, end: 2.4 },
    ]);
    expect(words.map((word) => word.joinsNext)).toEqual([true, false, false, false]);
    expect(wordsFromSpaced(spacedFromWords(words)).map(({ id: _id, ...word }) => word)).toEqual(
      words.map(({ id: _id, ...word }) => word),
    );
  });

  it("writes no group ids when the spacing already reads back the same joins", () => {
    const words = wordsFromSpaced([
      { text: "Pa", begin: 1, end: 1.2 },
      { text: "per ", begin: 1.2, end: 1.5 },
      { text: "boats", begin: 1.6, end: 2 },
    ]);
    expect(spacedFromWords(words).some((word) => "syllableGroupId" in word)).toBe(false);
  });

  it("puts group ids only on joined runs when the spacing would misread a join", () => {
    const words = wordsFromSpaced([
      { text: "far ", begin: 1, end: 1.2, syllableGroupId: "x" },
      { text: "away", begin: 1.2, end: 1.5, syllableGroupId: "x" },
      { text: "夜", begin: 1.6, end: 2 },
      { text: "空", begin: 2, end: 2.4 },
    ]);
    expect(spacedFromWords(words).map((word) => word.syllableGroupId)).toEqual(["w0", "w0", undefined, undefined]);
  });

  it("marks only the first misread word when nothing joins", () => {
    const words = wordsFromSpaced([
      { text: "夜", begin: 1, end: 1.5, syllableGroupId: "a" },
      { text: "空", begin: 1.5, end: 2, syllableGroupId: "b" },
      { text: "星", begin: 2, end: 2.5, syllableGroupId: "c" },
    ]);
    const saved = spacedFromWords(words);
    expect(saved.map((word) => word.syllableGroupId)).toEqual(["w0", undefined, undefined]);
    expect(wordsFromSpaced(saved).map((word) => word.joinsNext)).toEqual([false, false, false]);
  });

  it("never writes ids into saved words", () => {
    const words = wordsFromSpaced([
      { text: "Paper ", begin: 1, end: 2 },
      { text: "lanterns", begin: 2, end: 3 },
    ]);
    expect(words.every((word) => word.id.length > 0)).toBe(true);
    expect(spacedFromWords(words).some((word) => "id" in word)).toBe(false);
  });

  describe("joins read once on load (from inferSyllableGroupIds)", () => {
    const joinsOf = (words: Parameters<typeof wordsFromSpaced>[0]) => wordsFromSpaced(words).map((w) => w.joinsNext);

    it("joins each multi-word run inferred from the trailing-space pattern", () => {
      expect(
        joinsOf([
          { text: "ev", begin: 0, end: 0.2 },
          { text: "er", begin: 0.2, end: 0.4 },
          { text: "y ", begin: 0.4, end: 0.6 },
          { text: "world", begin: 0.6, end: 1 },
        ]),
      ).toEqual([true, true, false, false]);
    });

    it("keeps two separate runs in the same track apart", () => {
      expect(
        joinsOf([
          { text: "ev", begin: 0, end: 0.2 },
          { text: "er ", begin: 0.2, end: 0.4 },
          { text: "wi", begin: 0.4, end: 0.6 },
          { text: "de", begin: 0.6, end: 0.8 },
        ]),
      ).toEqual([true, false, true, false]);
    });

    it("joins nothing when every word is standalone", () => {
      expect(
        joinsOf([
          { text: "hello ", begin: 0, end: 1 },
          { text: "world", begin: 1, end: 2 },
        ]),
      ).toEqual([false, false]);
    });

    it("follows ids when a word already has one", () => {
      expect(
        joinsOf([
          { text: "ev", begin: 0, end: 0.2, syllableGroupId: "g1" },
          { text: "er", begin: 0.2, end: 0.4, syllableGroupId: "g1" },
          { text: "y", begin: 0.4, end: 0.6, syllableGroupId: "g1" },
        ]),
      ).toEqual([true, true, false]);
    });

    it("returns an empty track as-is", () => {
      expect(joinsOf([])).toEqual([]);
    });
  });
});
