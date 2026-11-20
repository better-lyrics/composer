import { lineFromFields } from "@/domain/line/line-from-fields";
import { getLanguageAlignmentErrorItems } from "@/domain/language/alignment-errors";
import type { LyricLine } from "@/domain/line/model";
import { legacyLine } from "@/test/legacy-languages";
import { describe, expect, it } from "vitest";

describe("getLanguageAlignmentErrorItems", () => {
  it("reports main and background transliteration errors by line", () => {
    const lines: LyricLine[] = [
      legacyLine({
        id: "l1",
        text: "가|나",
        agentId: "v1",
        words: [
          { id: "w1", text: "가", sep: "", begin: 0, end: 0.5, joinsNext: true },
          { id: "w2", text: "나", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
        backgroundText: "다|라",
        backgroundWords: [
          { id: "w3", text: "다", sep: "", begin: 0, end: 0.5, joinsNext: true },
          { id: "w4", text: "라", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
        backgroundTextSource: "manual",
        transliteration: {
          language: "ko-Latn",
          text: "g",
          backgroundText: "d",
          segments: [],
          origin: "manual",
          sourceFingerprint: "current",
        },
      }),
    ];

    expect(getLanguageAlignmentErrorItems(lines)).toEqual([
      {
        lineId: "l1",
        lineIndex: 0,
        text: "가|나",
        errors: [
          {
            field: "transliteration",
            message: "Word 1 has more timed syllables than the transliteration has parts.",
          },
          {
            field: "background-transliteration",
            message: "Word 1 has more timed syllables than the transliteration has parts.",
          },
        ],
      },
    ]);
  });

  it("omits aligned and empty transliterations", () => {
    const lines: LyricLine[] = [
      lineFromFields({ id: "empty", text: "가|나", agentId: "v1" }),
      legacyLine({
        id: "aligned",
        text: "가|나",
        agentId: "v1",
        words: [
          { id: "w5", text: "가", sep: "", begin: 0, end: 0.5, joinsNext: true },
          { id: "w6", text: "나", sep: "", begin: 0.5, end: 1, joinsNext: false },
        ],
        transliteration: {
          language: "ko-Latn",
          text: "ga na",
          segments: [],
          origin: "manual",
          sourceFingerprint: "current",
        },
      }),
    ];

    expect(getLanguageAlignmentErrorItems(lines)).toEqual([]);
  });
});
