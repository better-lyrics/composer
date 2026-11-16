import { describe, expect, it } from "vitest";
import { type LegacyLine, legacyLine, legacyView } from "@/test/legacy-languages";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { generateTTML } from "insync/ttml/write";
import { renderTransliterationContent } from "insync/ttml/alternate-content";
import { DEFAULT_SPLIT_CHARACTER } from "insync/split-character-text";

function lineWithMappings(): LegacyLine {
  return {
    id: "line-1",
    agentId: "v1",
    text: "今日",
    words: [
      {
        id: "w1",
        text: "今",
        sep: "",
        begin: 1,
        end: 1.5,
        transliteration: "kyou",
        transliterationJoinerAfter: "-",
        joinsNext: true,
      },
      { id: "w2", text: "日", sep: "", begin: 1.5, end: 2, transliteration: "hi", joinsNext: false },
    ],
    backgroundText: "青空",
    backgroundWords: [
      {
        id: "w3",
        text: "青",
        sep: "",
        begin: 2,
        end: 2.5,
        transliteration: "ao",
        transliterationJoinerAfter: "",
        joinsNext: true,
      },
      { id: "w4", text: "空", sep: "", begin: 2.5, end: 3, transliteration: "sora", joinsNext: false },
    ],
    backgroundTextSource: "manual",
    transliteration: {
      language: "ja-Latn",
      text: "kyou-hi",
      backgroundText: "aosora",
      segments: [],
      origin: "manual",
      sourceFingerprint: "test",
      // Export must recompute status rather than trust persisted flags.
      alignmentStatus: "confirmed",
      backgroundAlignmentStatus: "confirmed",
    },
  };
}

describe("TTML unresolved transliteration", () => {
  it.each(["main", "background"] as const)(
    "exports canonical %s text instead of stale timed mappings, retaining the other side's timing",
    (side) => {
      const line = lineWithMappings();
      if (side === "main") line.transliteration!.text = "x";
      else line.transliteration!.backgroundText = "x";
      const stored = legacyLine(line);
      const before = structuredClone(stored);

      const content = renderTransliterationContent(stored, DEFAULT_SPLIT_CHARACTER);

      if (side === "main") {
        expect(content).toMatch(/^x <span ttm:role="x-bg"><span[^>]+>ao<\/span><span[^>]+>sora<\/span><\/span>$/);
        expect(content).not.toContain("kyou");
      } else {
        expect(content).toMatch(/^<span[^>]+>kyou-<\/span><span[^>]+>hi<\/span> <span ttm:role="x-bg">x<\/span>$/);
        expect(content).not.toContain("sora");
      }
      expect(stored).toEqual(before);

      const ttml = generateTTML({
        metadata: { title: "Unresolved", artists: [], album: "", duration: 4, language: "ja" },
        agents: [{ id: "v1", type: "person", name: "Lead" }],
        lines: [stored],
        splitChar: DEFAULT_SPLIT_CHARACTER,
      });
      const parsed = legacyView(parseLyricsFile("song.ttml", ttml).lines[0]);
      expect(parsed.transliteration?.text).toBe(line.transliteration!.text);
      expect(parsed.transliteration?.backgroundText).toBe(line.transliteration!.backgroundText);
      const unaffectedWords = side === "main" ? parsed.backgroundWords : parsed.words;
      const originalWords = side === "main" ? line.backgroundWords : line.words;
      // Timing is unchanged; the exported dash now round-trips as part of its
      // preceding syllable rather than as an untimed joiner.
      expect(
        unaffectedWords?.map(({ begin, end, transliteration, transliterationJoinerAfter }) => ({
          begin,
          end,
          transliteration,
          transliterationJoinerAfter,
        })),
      ).toEqual(
        originalWords?.map(({ begin, end, transliteration, transliterationJoinerAfter }, index) => ({
          begin,
          end,
          transliteration: side === "background" && index === 0 ? `${transliteration}-` : transliteration,
          transliterationJoinerAfter: side === "background" && index === 0 ? "" : transliterationJoinerAfter,
        })),
      );
    },
  );

  it.each([true, false])("escapes unresolved canonical text with cached mappings=%s", (cached) => {
    const line = lineWithMappings();
    line.transliteration!.text = "&";
    line.transliteration!.backgroundText = "<";
    if (!cached) {
      line.words = (line.words ?? []).map(
        ({ transliteration: _text, transliterationJoinerAfter: _joiner, ...word }) => word,
      );
      line.backgroundWords = (line.backgroundWords ?? []).map(
        ({ transliteration: _text, transliterationJoinerAfter: _joiner, ...word }) => word,
      );
    }

    expect(renderTransliterationContent(legacyLine(line), DEFAULT_SPLIT_CHARACTER)).toBe(
      '&amp; <span ttm:role="x-bg">&lt;</span>',
    );
  });

  it("retains valid timing and visible punctuation even when persisted status is unresolved", () => {
    const line = lineWithMappings();
    line.transliteration!.alignmentStatus = "unresolved";
    line.transliteration!.backgroundAlignmentStatus = "unresolved";

    expect(renderTransliterationContent(legacyLine(line), DEFAULT_SPLIT_CHARACTER)).toMatch(
      /^<span[^>]+>kyou-<\/span><span[^>]+>hi<\/span> <span ttm:role="x-bg"><span[^>]+>ao<\/span><span[^>]+>sora<\/span><\/span>$/,
    );
  });

  it("regression: a syllable with no reading adds no source script to the romanization", () => {
    const stored = legacyLine({
      id: "line-1",
      agentId: "v1",
      text: "星の声よ",
      words: [
        { id: "w1", text: "星", sep: "", begin: 1, end: 1.5, transliteration: "hoshi", joinsNext: true },
        { id: "w2", text: "の", sep: "", begin: 1.5, end: 2, transliteration: "no", joinsNext: true },
        {
          id: "w3",
          text: "声",
          sep: "",
          begin: 2,
          end: 2.5,
          transliteration: "koe",
          transliterationJoinerAfter: "",
          joinsNext: true,
        },
        { id: "w4", text: "よ", sep: "", begin: 2.5, end: 3, transliteration: "", joinsNext: false },
      ],
      transliteration: {
        language: "ja-Latn",
        text: "hoshi no koe",
        segments: [],
        origin: "manual",
        sourceFingerprint: "test",
        alignmentStatus: "needs-review",
      },
    });

    const content = renderTransliterationContent(stored, DEFAULT_SPLIT_CHARACTER);

    expect(content).toContain("koe</span>");
    expect(content).not.toContain("よ");
  });

  it("regression: a background placed after a syllable stays after its reading when earlier syllables have none", () => {
    const stored = legacyLine({
      id: "line-1",
      agentId: "v1",
      text: "月 の 声 よ 空",
      words: [
        {
          id: "w1",
          text: "月",
          sep: " ",
          begin: 1,
          end: 1.5,
          transliteration: "",
          transliterationJoinerAfter: "",
          joinsNext: false,
        },
        {
          id: "w2",
          text: "の",
          sep: " ",
          begin: 1.5,
          end: 2,
          transliteration: "",
          transliterationJoinerAfter: "",
          joinsNext: false,
        },
        {
          id: "w3",
          text: "声",
          sep: " ",
          begin: 2,
          end: 2.5,
          transliteration: "koe",
          transliterationJoinerAfter: " ",
          joinsNext: false,
        },
        {
          id: "w4",
          text: "よ",
          sep: " ",
          begin: 3,
          end: 3.5,
          transliteration: "yo",
          transliterationJoinerAfter: " ",
          joinsNext: false,
        },
        { id: "w5", text: "空", sep: "", begin: 3.5, end: 4, transliteration: "sora", joinsNext: false },
      ],
      backgroundText: "青",
      backgroundWords: [
        { id: "w6", text: "青", sep: "", begin: 2.6, end: 2.9, transliteration: "ao", joinsNext: false },
      ],
      backgroundTextSource: "manual",
      transliteration: {
        language: "ja-Latn",
        text: "koe yo sora",
        backgroundText: "ao",
        segments: [],
        origin: "manual",
        sourceFingerprint: "test",
        alignmentStatus: "needs-review",
        backgroundAlignmentStatus: "needs-review",
      },
    });

    const content = renderTransliterationContent(stored, DEFAULT_SPLIT_CHARACTER);

    expect(content).toMatch(/koe<\/span> <span ttm:role="x-bg">.*ao.*<\/span><span[^>]+>yo<\/span>/);
  });
});
