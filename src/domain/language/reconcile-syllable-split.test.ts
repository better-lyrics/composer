import { withFields } from "@/test/field-updates";
import { fieldsOfLine } from "@/domain/line/line-from-fields";
import { describe, expect, it } from "vitest";
import { planTransliterationAlignment } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { positionalPieces } from "@/domain/language/pieces";
import { withoutPieces } from "@/domain/language/side-pieces";
import {
  splitWordIntoWordsKeepingTransliteration,
  splitWordsKeepingTransliteration,
  type WordSplitResult,
} from "@/domain/language/reconcile-syllable-split";
import type { V3TransliterationTrack } from "@/domain/language/v3-languages";
import { drawnLanguages, drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables, type WordTrack } from "@/domain/line/track";
import { newWordId } from "@/domain/word/id";
import { createWords } from "@/test/factories";
import {
  type LegacyWord,
  legacyLanguages,
  legacyLine,
  legacyWords,
  piecesOfLegacyWords,
} from "@/test/legacy-languages";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Helpers ------------------------------------------------------------------

interface LegacySplit {
  words: LegacyWord[];
  /** The track the split rewrote, or null when it left the track as it was. */
  transliteration: V3TransliterationTrack | null;
}

function asLegacySplit(line: LyricLine, type: WordTrack, result: WordSplitResult | null): LegacySplit | null {
  if (!result) return null;
  const before = line.languages?.transliteration;
  const after = result.languages?.transliteration;
  const rewritten = after && !(before && isStructurallyEqual(withoutPieces(before), withoutPieces(after)));
  return {
    words: legacyWords(result.words, result.languages, type === "word" ? "main" : "bg") ?? [],
    transliteration: rewritten ? (legacyLanguages(result.languages).transliteration ?? null) : null,
  };
}

function splitKeeping(line: LyricLine, type: WordTrack, index: number, replacements: LegacyWord[]) {
  const { words, pieces } = piecesOfLegacyWords(replacements);
  return asLegacySplit(
    line,
    type,
    splitWordsKeepingTransliteration(line, type, index, words, positionalPieces(words, pieces)),
  );
}

function splitIntoWordsKeeping(line: LyricLine, type: WordTrack, index: number, replacements: LegacyWord[]) {
  const { words, pieces } = piecesOfLegacyWords(replacements);
  return asLegacySplit(
    line,
    type,
    splitWordIntoWordsKeepingTransliteration(line, type, index, words, "|", positionalPieces(words, pieces)),
  );
}

// -- Fixtures -----------------------------------------------------------------

const track: V3TransliterationTrack = {
  language: "ko-Latn",
  text: "Uh  ildan eun  na",
  segments: [{ original: "Uh 일단은 나", transliteration: "Uh  ildan eun  na" }],
  origin: "google",
  sourceFingerprint: "source",
};

const ILDAN_SPLIT = [
  {
    id: "w1",
    text: "일",
    sep: "",
    begin: 0.5,
    end: 0.8,
    transliteration: "il",
    transliterationJoinerAfter: "",
    joinsNext: true,
  },
  { id: "w2", text: "단은", sep: " ", begin: 0.8, end: 1.5, transliteration: "dan eun", joinsNext: false },
];

function koreanLine(pieces: [string?, string?, string?] = []): LyricLine {
  const [first, second, third] = pieces;
  return legacyLine({
    id: "line",
    agentId: "v1",
    text: "Uh 일단은 나",
    words: createWords([
      { id: "w-uh", text: "Uh", sep: " ", begin: 0, end: 0.5, ...(first ? { transliteration: first } : {}) },
      {
        id: "w-ildaneun",
        text: "일단은",
        sep: " ",
        begin: 0.5,
        end: 1.5,
        ...(second ? { transliteration: second } : {}),
      },
      { id: "w-na", text: "나", sep: "", begin: 1.5, end: 2, ...(third ? { transliteration: third } : {}) },
    ]),
    transliteration: track,
  });
}

// -- Tests --------------------------------------------------------------------

describe("splitWordsKeepingTransliteration", () => {
  it("writes manually selected timing boundaries back to the canonical transliteration", () => {
    const line = koreanLine(["Uh", "ildan eun", "na"]);

    const result = splitKeeping(line, "word", 1, [
      {
        id: "w3",
        text: "일",
        sep: "",
        begin: 0.5,
        end: 0.8,
        transliteration: "i",
        transliterationJoinerAfter: "",
        joinsNext: true,
      },
      {
        id: "w4",
        text: "단",
        sep: "",
        begin: 0.8,
        end: 1.1,
        transliteration: "ldan",
        transliterationJoinerAfter: " ",
        joinsNext: true,
      },
      { id: "w5", text: "은", sep: " ", begin: 1.1, end: 1.5, transliteration: "eun", joinsNext: false },
    ]);

    expect(result?.transliteration?.text).toBe("Uh  ildan eun  na");
    expect(result?.transliteration?.segments).toEqual([
      { original: lineText(line), transliteration: "Uh  ildan eun  na" },
    ]);
    expect(result?.transliteration?.origin).toBe("manual");
    expect(result?.words.map((word) => word.text + word.sep)).toEqual(["Uh ", "일", "단", "은 ", "나"]);
  });

  it("rebuilds the whole syllable group when an existing syllable is split again", () => {
    const line: LyricLine = legacyLine({
      id: "line",
      agentId: "v1",
      text: "일|단은",
      words: [
        { id: "w6", text: "일", sep: "", begin: 0, end: 0.5, transliteration: "il", joinsNext: true },
        { id: "w7", text: "단은", sep: "", begin: 0.5, end: 1, transliteration: "daneun", joinsNext: false },
      ],
      transliteration: { ...track, text: "il daneun" },
    });

    const result = splitKeeping(line, "word", 0, [
      {
        id: "w8",
        text: "ㅇ",
        sep: "",
        begin: 0,
        end: 0.25,
        transliteration: "i",
        transliterationJoinerAfter: "",
        joinsNext: true,
      },
      { id: "w9", text: "ㄹ", sep: "", begin: 0.25, end: 0.5, transliteration: "l", joinsNext: false },
    ]);

    expect(result?.transliteration?.text).toBe("il daneun");
  });

  describe("regressions", () => {
    it("regression: an unpaired split never duplicates the piece into the track (#283)", () => {
      const result = splitKeeping(koreanLine(), "word", 1, [
        { id: "w10", text: "일", sep: "", begin: 0.5, end: 0.8, transliteration: "ildan eun", joinsNext: true },
        { id: "w11", text: "단은", sep: " ", begin: 0.8, end: 1.5, transliteration: "ildan eun", joinsNext: false },
      ]);

      expect(result?.transliteration).toBeNull();
      expect(result?.words.map((word) => word.transliteration)).toEqual(["Uh", undefined, undefined, "na"]);
    });

    it("regression: keeps the user's split when stored words lost their pieces (#283)", () => {
      const result = splitKeeping(koreanLine(), "word", 1, ILDAN_SPLIT);

      expect(result?.words.map((word) => word.transliteration)).toEqual(["Uh", "il", "dan eun", "na"]);
      expect(result?.transliteration?.text).toBe("Uh  ildan eun  na");
    });

    it("regression: ignores stale stored pieces that no longer match the track (#283)", () => {
      const result = splitKeeping(koreanLine(["Oh", "ildaneun", "nah"]), "word", 0, [
        {
          id: "w12",
          text: "U",
          sep: "",
          begin: 0,
          end: 0.25,
          transliteration: "U",
          transliterationJoinerAfter: "",
          joinsNext: true,
        },
        { id: "w13", text: "h", sep: " ", begin: 0.25, end: 0.5, transliteration: "h", joinsNext: false },
      ]);

      expect(result?.words.map((word) => word.transliteration)).toEqual(["U", "h", "ildan eun", "na"]);
      expect(result?.transliteration?.text).toBe("Uh  ildan eun  na");
    });
  });

  describe("invariants", () => {
    it("never upgrades a guessed alignment to confirmed", () => {
      const line: LyricLine = legacyLine({
        id: "line",
        agentId: "v1",
        text: "붙어있던",
        words: [
          { id: "w14", text: "붙", sep: "", begin: 0, end: 1, joinsNext: true },
          { id: "w15", text: "어", sep: "", begin: 1, end: 2, joinsNext: true },
          { id: "w16", text: "있던", sep: "", begin: 2, end: 3, joinsNext: false },
        ],
        transliteration: { ...track, text: "but eoissdeon", alignmentStatus: "confirmed" },
      });
      expect(
        planTransliterationAlignment(timedSyllables(mainTrack(line)) ?? [], undefined, "but eoissdeon").status,
      ).toBe("needs-review");

      const result = splitKeeping(line, "word", 2, [
        {
          id: "w17",
          text: "있",
          sep: "",
          begin: 2,
          end: 2.5,
          transliteration: "ss",
          transliterationJoinerAfter: "",
          joinsNext: true,
        },
        { id: "w18", text: "던", sep: "", begin: 2.5, end: 3, transliteration: "deon", joinsNext: false },
      ]);

      expect(result?.transliteration).not.toBeNull();
      expect(result?.transliteration?.alignmentStatus).toBe("needs-review");
    });

    it("keeps the base alignment status of an exact mapping", () => {
      const result = splitKeeping(koreanLine(), "word", 1, ILDAN_SPLIT);
      expect(result?.transliteration?.alignmentStatus).toBe("inferred");
    });

    it("drops the stale flag and keeps the rest of the track", () => {
      const line = legacyLine({ ...fieldsOfLine(koreanLine()), transliteration: { ...track, stale: true } });
      const result = splitKeeping(line, "word", 1, ILDAN_SPLIT);
      expect(result?.transliteration).not.toHaveProperty("stale");
      expect(result?.transliteration?.language).toBe("ko-Latn");
      expect(result?.transliteration?.sourceFingerprint).toBe("source");
    });

    it("does not mutate the input line or the replacement words", () => {
      const line = koreanLine(["Oh", "ildaneun", "nah"]);
      const lineBefore = structuredClone(line);
      const replacementsBefore = structuredClone(ILDAN_SPLIT);

      splitKeeping(line, "word", 1, ILDAN_SPLIT);

      expect(line).toEqual(lineBefore);
      expect(ILDAN_SPLIT).toEqual(replacementsBefore);
    });
  });

  describe("edge cases", () => {
    it("returns no track change when a replacement has no piece", () => {
      const line: LyricLine = legacyLine({
        id: "line",
        agentId: "v1",
        text: "일단은",
        words: [
          { id: "w19", text: "일단은", sep: "", begin: 0, end: 1, transliteration: "ildan eun", joinsNext: false },
        ],
        transliteration: { ...track, text: "ildan eun" },
      });

      const result = splitKeeping(line, "word", 0, [
        { id: "w20", text: "일", sep: "", begin: 0, end: 0.5, transliteration: "il", joinsNext: true },
        { id: "w21", text: "단은", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ]);

      expect(result?.transliteration).toBeNull();
      expect(result?.words.map((word) => word.text)).toEqual(["일", "단은"]);
    });

    it("splits a line without a transliteration track", () => {
      const { languages: _languages, ...line } = koreanLine();

      const result = splitKeeping(line, "word", 1, [
        { id: "w22", text: "일", sep: "", begin: 0.5, end: 0.8, joinsNext: true },
        { id: "w23", text: "단은", sep: " ", begin: 0.8, end: 1.5, joinsNext: false },
      ]);

      expect(result?.transliteration).toBeNull();
      expect(result?.words.map((word) => word.text + word.sep)).toEqual(["Uh ", "일", "단은 ", "나"]);
      expect(result?.words.every((word) => word.transliteration === undefined)).toBe(true);
    });

    it("splits a line-synced line through its effective word", () => {
      const line: LyricLine = legacyLine({
        id: "line",
        agentId: "v1",
        text: "일단은",
        begin: 0,
        end: 1,
        transliteration: { ...track, text: "ildan eun" },
      });

      const result = splitKeeping(line, "word", 0, [
        {
          id: "w24",
          text: "일",
          sep: "",
          begin: 0,
          end: 0.4,
          transliteration: "il",
          transliterationJoinerAfter: "",
          joinsNext: true,
        },
        { id: "w25", text: "단은", sep: "", begin: 0.4, end: 1, transliteration: "dan eun", joinsNext: false },
      ]);

      expect(result?.words.map((word) => word.text)).toEqual(["일", "단은"]);
      expect(result?.transliteration?.text).toBe("ildan eun");
    });

    it("regression: a multi-word line-synced line keeps every word of its transliteration (#296)", () => {
      const line: LyricLine = legacyLine({
        id: "line",
        agentId: "v1",
        text: "일단은 나",
        begin: 0,
        end: 1,
        transliteration: { ...track, text: "ildan eun  na" },
      });

      expect(legacyWords(drawnSyllables(line, "main"), drawnLanguages(line))?.[0].transliteration).toBe(
        "ildan eun  na",
      );

      const result = splitKeeping(line, "word", 0, [
        {
          id: "w26",
          text: "일",
          sep: "",
          begin: 0,
          end: 0.4,
          transliteration: "il",
          transliterationJoinerAfter: "",
          joinsNext: true,
        },
        {
          id: "w27",
          text: "단은 나",
          sep: "",
          begin: 0.4,
          end: 1,
          transliteration: "dan eun  na",
          joinsNext: false,
        },
      ]);

      expect(result?.words.map((word) => word.transliteration)).toEqual(["il", "dan eun  na"]);
      expect(result?.transliteration?.text).toBe("ildan eun  na");
    });

    it("splits the background track and writes backgroundText", () => {
      const line: LyricLine = legacyLine({
        ...fieldsOfLine(koreanLine()),
        backgroundText: "그래 yeah",
        backgroundWords: [
          { id: "w28", text: "그래", sep: " ", begin: 2, end: 2.5, joinsNext: false },
          { id: "w29", text: "yeah", sep: "", begin: 2.5, end: 3, joinsNext: false },
        ],
        transliteration: {
          ...track,
          backgroundText: "geurae  yeah",
          backgroundSegments: [{ original: "그래 yeah", transliteration: "geurae  yeah" }],
          backgroundAlignmentStatus: "confirmed",
        },
      });

      const result = splitKeeping(line, "bg", 0, [
        {
          id: "w30",
          text: "그",
          sep: "",
          begin: 2,
          end: 2.2,
          transliteration: "geu",
          transliterationJoinerAfter: "",
          joinsNext: true,
        },
        { id: "w31", text: "래", sep: " ", begin: 2.2, end: 2.5, transliteration: "rae", joinsNext: false },
      ]);

      expect(result?.words.map((word) => word.text + word.sep)).toEqual(["그", "래 ", "yeah"]);
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
      const untimed: LyricLine = legacyLine({ id: "line", agentId: "v1", text: "일단은", transliteration: track });
      expect(splitKeeping(untimed, "word", 0, ILDAN_SPLIT)).toBeNull();
      expect(splitKeeping(koreanLine(), "bg", 0, ILDAN_SPLIT)).toBeNull();
    });
  });
});

describe("splitWordIntoWordsKeepingTransliteration", () => {
  function line(sourceFingerprint: string): LyricLine {
    return legacyLine({
      id: "line",
      agentId: "v1",
      text: "хорошо",
      words: [
        { id: newWordId(), text: "хорошо", sep: "", begin: 0, end: 1, transliteration: "khorosho", joinsNext: false },
      ],
      transliteration: {
        language: "ru-Latn",
        text: "khorosho",
        segments: [],
        origin: "manual",
        sourceFingerprint,
        alignmentStatus: "confirmed",
      },
    });
  }
  const pieces = [
    {
      id: "w32",
      text: "хор",
      sep: " ",
      begin: 0,
      end: 0.5,
      transliteration: "khor",
      transliterationJoinerAfter: "",
      joinsNext: false,
    },
    { id: "w33", text: "ошо", sep: "", begin: 0.5, end: 1, transliteration: "osho", joinsNext: false },
  ];

  it("re-stamps the track against the split text", () => {
    const result = splitIntoWordsKeeping(line(languageSourceFingerprint("хорошо")), "word", 0, pieces)?.transliteration;

    expect(result?.text).toBe("khorosho");
    expect(result?.segments).toEqual([{ original: "хор ошо", transliteration: "khorosho" }]);
    expect(result?.sourceFingerprint).toBe(languageSourceFingerprint("хор ошо"));
  });

  it("re-stamps the track of a line-timed line, whose words are derived", () => {
    const lineTimed = withFields(line(languageSourceFingerprint("хорошо")), { words: undefined, begin: 0, end: 1 });
    const result = splitIntoWordsKeeping(lineTimed, "word", 0, pieces)?.transliteration;

    expect(result?.text).toBe("khorosho");
    expect(result?.sourceFingerprint).toBe(languageSourceFingerprint("хор ошо"));
  });

  it("keeps the other words' transliteration when one word of a line is split", () => {
    const multiWord: LyricLine = legacyLine({
      id: "line",
      agentId: "v1",
      text: "да хорошо",
      words: [
        { id: "w34", text: "да", sep: " ", begin: 0, end: 0.5, joinsNext: false },
        { id: "w35", text: "хорошо", sep: "", begin: 0.5, end: 1, joinsNext: false },
      ],
      transliteration: {
        language: "ru-Latn",
        text: "da  khorosho",
        segments: [],
        origin: "manual",
        sourceFingerprint: languageSourceFingerprint("да хорошо"),
      },
    });
    const result = splitIntoWordsKeeping(multiWord, "word", 1, [
      {
        id: "w36",
        text: "хор",
        sep: " ",
        begin: 0.5,
        end: 0.75,
        transliteration: "khor",
        transliterationJoinerAfter: "",
        joinsNext: false,
      },
      { id: "w37", text: "ошо", sep: "", begin: 0.75, end: 1, transliteration: "osho", joinsNext: false },
    ])?.transliteration;

    expect(result?.text).toBe("da  khorosho");
    expect(result?.sourceFingerprint).toBe(languageSourceFingerprint("да хор ошо"));
  });

  it("keeps the track's origin", () => {
    const google = line(languageSourceFingerprint("хорошо"));
    const googleTrack = google.languages?.transliteration;
    if (googleTrack) googleTrack.origin = "google";

    expect(splitIntoWordsKeeping(google, "word", 0, pieces)?.transliteration?.origin).toBe("google");
  });

  it("re-stamps a background-only track when the main words are split", () => {
    const backgroundOnly: LyricLine = legacyLine({
      id: "line",
      agentId: "v1",
      text: "everyday",
      backgroundText: "привет",
      words: [{ id: "w38", text: "everyday", sep: "", begin: 0, end: 1, joinsNext: false }],
      transliteration: {
        language: "ru-Latn",
        text: "",
        backgroundText: "privet",
        segments: [],
        origin: "manual",
        sourceFingerprint: languageSourceFingerprint("everyday", "привет"),
      },
    });
    const result = splitIntoWordsKeeping(backgroundOnly, "word", 0, [
      { id: "w39", text: "every", sep: " ", begin: 0, end: 0.5, joinsNext: false },
      { id: "w40", text: "day", sep: "", begin: 0.5, end: 1, joinsNext: false },
    ])?.transliteration;

    expect(result).toMatchObject({ text: "", backgroundText: "privet", origin: "manual" });
    expect(result?.sourceFingerprint).toBe(languageSourceFingerprint("every day", "привет"));
  });

  it("rewrites the background side when a background word is split", () => {
    const background: LyricLine = legacyLine({
      id: "line",
      agentId: "v1",
      text: "da",
      backgroundText: "хорошо",
      backgroundWords: [
        { id: "w41", text: "хорошо", sep: "", begin: 0, end: 1, transliteration: "khorosho", joinsNext: false },
      ],
      transliteration: {
        language: "ru-Latn",
        text: "da",
        backgroundText: "khorosho",
        segments: [],
        origin: "manual",
        sourceFingerprint: languageSourceFingerprint("da", "хорошо"),
      },
    });
    const result = splitIntoWordsKeeping(background, "bg", 0, pieces)?.transliteration;

    expect(result).toMatchObject({ text: "da", backgroundText: "khorosho" });
    expect(result?.backgroundSegments).toEqual([{ original: "хор ошо", transliteration: "khorosho" }]);
    expect(result?.sourceFingerprint).toBe(languageSourceFingerprint("da", "хор ошо"));
  });

  it("keeps an already out-of-date track flagged for review", () => {
    const result = splitIntoWordsKeeping(line("older source"), "word", 0, pieces)?.transliteration;

    expect(result?.sourceFingerprint).toBe("older source");
  });
});
