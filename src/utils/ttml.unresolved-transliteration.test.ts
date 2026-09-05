import type { LyricLine } from "@/domain/line/model";
import { parseLyricsFile } from "@/utils/lyrics-parsers";
import { generateTTML } from "@/utils/ttml";
import { renderTransliterationContent } from "@/utils/ttml-alternate-content";
import { describe, expect, it } from "vitest";

function lineWithMappings(): LyricLine {
  return {
    id: "line-1",
    agentId: "v1",
    text: "今日",
    words: [
      { text: "今", begin: 1, end: 1.5, transliteration: "kyou", transliterationJoinerAfter: "-" },
      { text: "日", begin: 1.5, end: 2, transliteration: "hi" },
    ],
    backgroundText: "青空",
    backgroundWords: [
      { text: "青", begin: 2, end: 2.5, transliteration: "ao", transliterationJoinerAfter: "" },
      { text: "空", begin: 2.5, end: 3, transliteration: "sora" },
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
      const before = structuredClone(line);

      const content = renderTransliterationContent(line);

      if (side === "main") {
        expect(content).toMatch(/^x <span ttm:role="x-bg"><span[^>]+>ao<\/span><span[^>]+>sora<\/span><\/span>$/);
        expect(content).not.toContain("kyou");
      } else {
        expect(content).toMatch(/^<span[^>]+>kyou-<\/span><span[^>]+>hi<\/span> <span ttm:role="x-bg">x<\/span>$/);
        expect(content).not.toContain("sora");
      }
      expect(line).toEqual(before);

      const ttml = generateTTML({
        metadata: { title: "Unresolved", artists: [], album: "", duration: 4, language: "ja" },
        agents: [{ id: "v1", type: "person", name: "Lead" }],
        lines: [line],
        granularity: "word",
      });
      const parsed = parseLyricsFile("song.ttml", ttml).lines[0];
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
      line.words = line.words!.map(({ transliteration: _text, transliterationJoinerAfter: _joiner, ...word }) => word);
      line.backgroundWords = line.backgroundWords!.map(
        ({ transliteration: _text, transliterationJoinerAfter: _joiner, ...word }) => word,
      );
    }

    expect(renderTransliterationContent(line)).toBe('&amp; <span ttm:role="x-bg">&lt;</span>');
  });

  it("retains valid timing and visible punctuation even when persisted status is unresolved", () => {
    const line = lineWithMappings();
    line.transliteration!.alignmentStatus = "unresolved";
    line.transliteration!.backgroundAlignmentStatus = "unresolved";

    expect(renderTransliterationContent(line)).toMatch(
      /^<span[^>]+>kyou-<\/span><span[^>]+>hi<\/span> <span ttm:role="x-bg"><span[^>]+>ao<\/span><span[^>]+>sora<\/span><\/span>$/,
    );
  });
});
