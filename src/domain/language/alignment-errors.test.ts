import { getLanguageAlignmentErrorItems } from "@/domain/language/alignment-errors";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

describe("getLanguageAlignmentErrorItems", () => {
  it("reports main and background transliteration errors by line", () => {
    const lines: LyricLine[] = [
      {
        id: "l1",
        text: "가|나",
        agentId: "v1",
        words: [
          { text: "가", begin: 0, end: 0.5, syllableGroupId: "main" },
          { text: "나", begin: 0.5, end: 1, syllableGroupId: "main" },
        ],
        backgroundText: "다|라",
        backgroundWords: [
          { text: "다", begin: 0, end: 0.5, syllableGroupId: "background" },
          { text: "라", begin: 0.5, end: 1, syllableGroupId: "background" },
        ],
        backgroundTextSource: "manual",
        transliteration: {
          language: "ko-Latn",
          text: "gana",
          backgroundText: "dara",
          segments: [],
          origin: "manual",
          sourceFingerprint: "current",
        },
      },
    ];

    expect(getLanguageAlignmentErrorItems(lines)).toEqual([
      {
        lineId: "l1",
        lineIndex: 0,
        text: "가|나",
        errors: [
          {
            field: "transliteration",
            message:
              "Original word 1 is split into 2 timed syllables, but its transliteration has 1 dash-separated syllable.",
          },
          {
            field: "background-transliteration",
            message:
              "Original word 1 is split into 2 timed syllables, but its transliteration has 1 dash-separated syllable.",
          },
        ],
      },
    ]);
  });

  it("omits aligned and empty transliterations", () => {
    const lines: LyricLine[] = [
      { id: "empty", text: "가|나", agentId: "v1" },
      {
        id: "aligned",
        text: "가|나",
        agentId: "v1",
        words: [
          { text: "가", begin: 0, end: 0.5, syllableGroupId: "group" },
          { text: "나", begin: 0.5, end: 1, syllableGroupId: "group" },
        ],
        transliteration: {
          language: "ko-Latn",
          text: "ga-na",
          segments: [],
          origin: "manual",
          sourceFingerprint: "current",
        },
      },
    ];

    expect(getLanguageAlignmentErrorItems(lines)).toEqual([]);
  });
});
