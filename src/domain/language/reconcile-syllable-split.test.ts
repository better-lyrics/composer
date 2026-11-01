import { planTransliterationAlignment } from "@/domain/language/align";
import type { TransliterationTrack } from "@/domain/language/model";
import { splitWordsKeepingTransliteration } from "@/domain/language/reconcile-syllable-split";
import { getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

// -- Fixtures -----------------------------------------------------------------

const track: TransliterationTrack = {
  language: "ko-Latn",
  text: "Uh  ildan eun  na",
  segments: [{ original: "Uh 일단은 나", transliteration: "Uh  ildan eun  na" }],
  origin: "google",
  sourceFingerprint: "source",
};

const ILDAN_SPLIT = [
  { text: "일", begin: 0.5, end: 0.8, transliteration: "il", transliterationJoinerAfter: "", syllableGroupId: "g" },
  { text: "단은 ", begin: 0.8, end: 1.5, transliteration: "dan eun", syllableGroupId: "g" },
];

function koreanLine(pieces: [string?, string?, string?] = []): LyricLine {
  const [first, second, third] = pieces;
  return {
    id: "line",
    agentId: "v1",
    text: "Uh 일단은 나",
    words: [
      { text: "Uh ", begin: 0, end: 0.5, ...(first ? { transliteration: first } : {}) },
      { text: "일단은 ", begin: 0.5, end: 1.5, ...(second ? { transliteration: second } : {}) },
      { text: "나", begin: 1.5, end: 2, ...(third ? { transliteration: third } : {}) },
    ],
    transliteration: track,
  };
}

// -- Tests --------------------------------------------------------------------

describe("splitWordsKeepingTransliteration", () => {
  it("writes manually selected timing boundaries back to the canonical transliteration", () => {
    const line = koreanLine(["Uh", "ildan eun", "na"]);

    const result = splitWordsKeepingTransliteration(line, "word", 1, [
      {
        text: "일",
        begin: 0.5,
        end: 0.8,
        transliteration: "i",
        transliterationJoinerAfter: "",
        syllableGroupId: "group",
      },
      {
        text: "단",
        begin: 0.8,
        end: 1.1,
        transliteration: "ldan",
        transliterationJoinerAfter: " ",
        syllableGroupId: "group",
      },
      { text: "은 ", begin: 1.1, end: 1.5, transliteration: "eun", syllableGroupId: "group" },
    ]);

    expect(result?.transliteration?.text).toBe("Uh  ildan eun  na");
    expect(result?.transliteration?.segments).toEqual([{ original: line.text, transliteration: "Uh  ildan eun  na" }]);
    expect(result?.transliteration?.origin).toBe("manual");
    expect(result?.words.map((word) => word.text)).toEqual(["Uh ", "일", "단", "은 ", "나"]);
  });

  it("rebuilds the whole syllable group when an existing syllable is split again", () => {
    const line: LyricLine = {
      id: "line",
      agentId: "v1",
      text: "일|단은",
      words: [
        { text: "일", begin: 0, end: 0.5, transliteration: "il", syllableGroupId: "group" },
        { text: "단은", begin: 0.5, end: 1, transliteration: "daneun", syllableGroupId: "group" },
      ],
      transliteration: { ...track, text: "il daneun" },
    };

    const result = splitWordsKeepingTransliteration(line, "word", 0, [
      {
        text: "ㅇ",
        begin: 0,
        end: 0.25,
        transliteration: "i",
        transliterationJoinerAfter: "",
        syllableGroupId: "group",
      },
      { text: "ㄹ", begin: 0.25, end: 0.5, transliteration: "l", syllableGroupId: "group" },
    ]);

    expect(result?.transliteration?.text).toBe("il daneun");
  });

  describe("regressions", () => {
    it("regression: an unpaired split never duplicates the piece into the track (#283)", () => {
      const result = splitWordsKeepingTransliteration(koreanLine(), "word", 1, [
        { text: "일", begin: 0.5, end: 0.8, transliteration: "ildan eun", syllableGroupId: "g" },
        { text: "단은 ", begin: 0.8, end: 1.5, transliteration: "ildan eun", syllableGroupId: "g" },
      ]);

      expect(result?.transliteration).toBeNull();
      expect(result?.words.map((word) => word.transliteration)).toEqual(["Uh", undefined, undefined, "na"]);
    });

    it("regression: keeps the user's split when stored words lost their pieces (#283)", () => {
      const result = splitWordsKeepingTransliteration(koreanLine(), "word", 1, ILDAN_SPLIT);

      expect(result?.words.map((word) => word.transliteration)).toEqual(["Uh", "il", "dan eun", "na"]);
      expect(result?.transliteration?.text).toBe("Uh  ildan eun  na");
    });

    it("regression: ignores stale stored pieces that no longer match the track (#283)", () => {
      const result = splitWordsKeepingTransliteration(koreanLine(["Oh", "ildaneun", "nah"]), "word", 0, [
        { text: "U", begin: 0, end: 0.25, transliteration: "U", transliterationJoinerAfter: "", syllableGroupId: "g" },
        { text: "h ", begin: 0.25, end: 0.5, transliteration: "h", syllableGroupId: "g" },
      ]);

      expect(result?.words.map((word) => word.transliteration)).toEqual(["U", "h", "ildan eun", "na"]);
      expect(result?.transliteration?.text).toBe("Uh  ildan eun  na");
    });
  });

  describe("invariants", () => {
    it("never upgrades a guessed alignment to confirmed", () => {
      const line: LyricLine = {
        id: "line",
        agentId: "v1",
        text: "붙어있던",
        words: [
          { text: "붙", begin: 0, end: 1, syllableGroupId: "g" },
          { text: "어", begin: 1, end: 2, syllableGroupId: "g" },
          { text: "있던", begin: 2, end: 3, syllableGroupId: "g" },
        ],
        transliteration: { ...track, text: "but eoissdeon", alignmentStatus: "confirmed" },
      };
      expect(planTransliterationAlignment(line.words ?? [], "but eoissdeon").status).toBe("needs-review");

      const result = splitWordsKeepingTransliteration(line, "word", 2, [
        {
          text: "있",
          begin: 2,
          end: 2.5,
          transliteration: "ss",
          transliterationJoinerAfter: "",
          syllableGroupId: "g",
        },
        { text: "던", begin: 2.5, end: 3, transliteration: "deon", syllableGroupId: "g" },
      ]);

      expect(result?.transliteration).not.toBeNull();
      expect(result?.transliteration?.alignmentStatus).toBe("needs-review");
    });

    it("keeps the base alignment status of an exact mapping", () => {
      const result = splitWordsKeepingTransliteration(koreanLine(), "word", 1, ILDAN_SPLIT);
      expect(result?.transliteration?.alignmentStatus).toBe("inferred");
    });

    it("drops the stale flag and keeps the rest of the track", () => {
      const line = { ...koreanLine(), transliteration: { ...track, stale: true } };
      const result = splitWordsKeepingTransliteration(line, "word", 1, ILDAN_SPLIT);
      expect(result?.transliteration).not.toHaveProperty("stale");
      expect(result?.transliteration?.language).toBe("ko-Latn");
      expect(result?.transliteration?.sourceFingerprint).toBe("source");
    });

    it("does not mutate the input line or the replacement words", () => {
      const line = koreanLine(["Oh", "ildaneun", "nah"]);
      const lineBefore = structuredClone(line);
      const replacementsBefore = structuredClone(ILDAN_SPLIT);

      splitWordsKeepingTransliteration(line, "word", 1, ILDAN_SPLIT);

      expect(line).toEqual(lineBefore);
      expect(ILDAN_SPLIT).toEqual(replacementsBefore);
    });
  });

  describe("edge cases", () => {
    it("returns no track change when a replacement has no piece", () => {
      const line: LyricLine = {
        id: "line",
        agentId: "v1",
        text: "일단은",
        words: [{ text: "일단은", begin: 0, end: 1, transliteration: "ildan eun" }],
        transliteration: { ...track, text: "ildan eun" },
      };

      const result = splitWordsKeepingTransliteration(line, "word", 0, [
        { text: "일", begin: 0, end: 0.5, transliteration: "il" },
        { text: "단은", begin: 0.5, end: 1 },
      ]);

      expect(result?.transliteration).toBeNull();
      expect(result?.words.map((word) => word.text)).toEqual(["일", "단은"]);
    });

    it("splits a line without a transliteration track", () => {
      const { transliteration: _track, ...line } = koreanLine();

      const result = splitWordsKeepingTransliteration(line, "word", 1, [
        { text: "일", begin: 0.5, end: 0.8, syllableGroupId: "g" },
        { text: "단은 ", begin: 0.8, end: 1.5, syllableGroupId: "g" },
      ]);

      expect(result?.transliteration).toBeNull();
      expect(result?.words.map((word) => word.text)).toEqual(["Uh ", "일", "단은 ", "나"]);
      expect(result?.words.every((word) => word.transliteration === undefined)).toBe(true);
    });

    it("splits a line-synced line through its effective word", () => {
      const line: LyricLine = {
        id: "line",
        agentId: "v1",
        text: "일단은",
        begin: 0,
        end: 1,
        transliteration: { ...track, text: "ildan eun" },
      };

      const result = splitWordsKeepingTransliteration(line, "word", 0, [
        { text: "일", begin: 0, end: 0.4, transliteration: "il", transliterationJoinerAfter: "", syllableGroupId: "g" },
        { text: "단은", begin: 0.4, end: 1, transliteration: "dan eun", syllableGroupId: "g" },
      ]);

      expect(result?.words.map((word) => word.text)).toEqual(["일", "단은"]);
      expect(result?.transliteration?.text).toBe("ildan eun");
    });

    it("regression: a multi-word line-synced line keeps every word of its transliteration (#296)", () => {
      const line: LyricLine = {
        id: "line",
        agentId: "v1",
        text: "일단은 나",
        begin: 0,
        end: 1,
        transliteration: { ...track, text: "ildan eun  na" },
      };

      expect(getEffectiveLines([line])[0].words?.[0].transliteration).toBe("ildan eun  na");

      const result = splitWordsKeepingTransliteration(line, "word", 0, [
        { text: "일", begin: 0, end: 0.4, transliteration: "il", transliterationJoinerAfter: "", syllableGroupId: "g" },
        { text: "단은 나", begin: 0.4, end: 1, transliteration: "dan eun  na", syllableGroupId: "g" },
      ]);

      expect(result?.words.map((word) => word.transliteration)).toEqual(["il", "dan eun  na"]);
      expect(result?.transliteration?.text).toBe("ildan eun  na");
    });

    it("splits the background track and writes backgroundText", () => {
      const line: LyricLine = {
        ...koreanLine(),
        backgroundText: "그래 yeah",
        backgroundWords: [
          { text: "그래 ", begin: 2, end: 2.5 },
          { text: "yeah", begin: 2.5, end: 3 },
        ],
        transliteration: {
          ...track,
          backgroundText: "geurae  yeah",
          backgroundSegments: [{ original: "그래 yeah", transliteration: "geurae  yeah" }],
          backgroundAlignmentStatus: "confirmed",
        },
      };

      const result = splitWordsKeepingTransliteration(line, "bg", 0, [
        {
          text: "그",
          begin: 2,
          end: 2.2,
          transliteration: "geu",
          transliterationJoinerAfter: "",
          syllableGroupId: "g",
        },
        { text: "래 ", begin: 2.2, end: 2.5, transliteration: "rae", syllableGroupId: "g" },
      ]);

      expect(result?.words.map((word) => word.text)).toEqual(["그", "래 ", "yeah"]);
      expect(result?.words.map((word) => word.transliteration)).toEqual(["geu", "rae", "yeah"]);
      expect(result?.transliteration?.backgroundText).toBe("geurae  yeah");
      expect(result?.transliteration?.backgroundSegments).toEqual([
        { original: "그래 yeah", transliteration: "geurae  yeah" },
      ]);
      expect(result?.transliteration?.backgroundAlignmentStatus).toBe("inferred");
      expect(result?.transliteration?.text).toBe(track.text);
      expect(result?.transliteration?.origin).toBe("manual");
    });

    it("returns null for a line with no words on that track", () => {
      const untimed: LyricLine = { id: "line", agentId: "v1", text: "일단은", transliteration: track };
      expect(splitWordsKeepingTransliteration(untimed, "word", 0, ILDAN_SPLIT)).toBeNull();
      expect(splitWordsKeepingTransliteration(koreanLine(), "bg", 0, ILDAN_SPLIT)).toBeNull();
    });
  });
});
