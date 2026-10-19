import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LanguageContentOrigin } from "@/domain/language/model";
import { staleGeneratedLanguages } from "@/domain/language/stale-generated";
import type { LyricLine } from "@/domain/line/model";
import { describe, expect, it } from "vitest";

function lineWithTracks(
  id: string,
  text: string,
  {
    sourceText = text,
    transliteration,
    translations = {},
  }: {
    sourceText?: string;
    transliteration?: LanguageContentOrigin;
    translations?: Record<string, LanguageContentOrigin>;
  } = {},
): LyricLine {
  const sourceFingerprint = languageSourceFingerprint(sourceText);
  return {
    id,
    agentId: "v1",
    text,
    ...(transliteration
      ? {
          transliteration: {
            language: "ru-Latn",
            text: "privet",
            segments: [],
            origin: transliteration,
            sourceFingerprint,
          },
        }
      : {}),
    translations: Object.fromEntries(
      Object.entries(translations).map(([language, origin]) => [
        language,
        { language, text: "hello", origin, sourceFingerprint },
      ]),
    ),
  };
}

describe("staleGeneratedLanguages", () => {
  it("finds a line whose generated transliteration was made for other text", () => {
    const lines = [lineWithTracks("a", "Здравствуй", { sourceText: "Привет", transliteration: "google" })];

    expect(staleGeneratedLanguages(lines)).toEqual([{ lineIds: ["a"], transliteration: true, translations: [] }]);
  });

  it("finds a line whose generated translation was made for other text", () => {
    const lines = [lineWithTracks("a", "Здравствуй", { sourceText: "Привет", translations: { en: "google" } })];

    expect(staleGeneratedLanguages(lines)).toEqual([{ lineIds: ["a"], transliteration: false, translations: ["en"] }]);
  });

  it("groups stale lines that need the same tracks", () => {
    const lines = [
      lineWithTracks("a", "Здравствуй", {
        sourceText: "Привет",
        transliteration: "google",
        translations: { en: "google" },
      }),
      lineWithTracks("b", "Где ты", { transliteration: "google", translations: { en: "google" } }),
      lineWithTracks("c", "Мой друг", { sourceText: "Друг", translations: { de: "google", en: "google" } }),
      lineWithTracks("d", "Ночь", { sourceText: "День", transliteration: "google", translations: { en: "google" } }),
    ];

    expect(staleGeneratedLanguages(lines)).toEqual([
      { lineIds: ["a", "d"], transliteration: true, translations: ["en"] },
      { lineIds: ["c"], transliteration: false, translations: ["de", "en"] },
    ]);
  });

  describe("edge cases", () => {
    it("finds nothing in no lines", () => {
      expect(staleGeneratedLanguages([])).toEqual([]);
    });

    it("finds nothing when every generated track matches its line", () => {
      const lines = [lineWithTracks("a", "Привет", { transliteration: "google", translations: { en: "google" } })];

      expect(staleGeneratedLanguages(lines)).toEqual([]);
    });

    it("finds nothing in lines without language tracks", () => {
      expect(staleGeneratedLanguages([{ id: "a", agentId: "v1", text: "Привет" }])).toEqual([]);
    });

    it("does not count a syllable split as a text change", () => {
      const lines = [lineWithTracks("a", "При|вет", { sourceText: "Привет", transliteration: "google" })];

      expect(staleGeneratedLanguages(lines)).toEqual([]);
    });

    it("counts a background vocal change as a text change", () => {
      const line = lineWithTracks("a", "Привет", { transliteration: "google" });

      expect(staleGeneratedLanguages([{ ...line, backgroundText: "эй" }])).toEqual([
        { lineIds: ["a"], transliteration: true, translations: [] },
      ]);
    });

    it.each(["manual", "import"] as const)("never refreshes %s tracks", (origin) => {
      const lines = [
        lineWithTracks("a", "Здравствуй", {
          sourceText: "Привет",
          transliteration: origin,
          translations: { en: origin },
        }),
      ];

      expect(staleGeneratedLanguages(lines)).toEqual([]);
    });

    it("refreshes only the generated side when a line mixes origins", () => {
      const lines = [
        lineWithTracks("a", "Здравствуй", {
          sourceText: "Привет",
          transliteration: "manual",
          translations: { en: "google", de: "manual" },
        }),
      ];

      expect(staleGeneratedLanguages(lines)).toEqual([
        { lineIds: ["a"], transliteration: false, translations: ["en"] },
      ]);
    });
  });

  describe("regressions", () => {
    it("regression: never asks for a track a line does not have", () => {
      const lines = [
        lineWithTracks("a", "Здравствуй", { sourceText: "Привет", transliteration: "google" }),
        lineWithTracks("b", "Пока", { sourceText: "До встречи", translations: { en: "google" } }),
      ];

      expect(staleGeneratedLanguages(lines)).toEqual([
        { lineIds: ["a"], transliteration: true, translations: [] },
        { lineIds: ["b"], transliteration: false, translations: ["en"] },
      ]);
    });
  });

  describe("invariants", () => {
    it("does not mutate the lines", () => {
      const lines = [lineWithTracks("a", "Здравствуй", { sourceText: "Привет", transliteration: "google" })];
      const before = structuredClone(lines);

      staleGeneratedLanguages(lines);

      expect(lines).toEqual(before);
    });

    it("groups lines by their tracks whatever order the languages were added in", () => {
      const lines = [
        lineWithTracks("a", "Один", { sourceText: "x", translations: { fr: "google", en: "google" } }),
        lineWithTracks("b", "Два", { sourceText: "y", translations: { en: "google", fr: "google" } }),
      ];

      expect(staleGeneratedLanguages(lines)).toEqual([
        { lineIds: ["a", "b"], transliteration: false, translations: ["en", "fr"] },
      ]);
    });
  });
});
