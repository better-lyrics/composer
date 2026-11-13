import { describe, expect, it } from "vitest";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import { applyLineUpdates } from "@/domain/line/apply-line-updates";
import type { LyricLine } from "@/domain/line/model";
import { backgroundText, lineText } from "@/domain/line/text";
import { roleWords } from "@/domain/line/track";
import type { TranslationLineResult, TransliterationLineResult } from "@/services/language-provider";
import { type LegacyLine, legacyLanguages, legacyLine, legacyView, legacyWords } from "@/test/legacy-languages";
import { isStructurallyEqual } from "@/utils/structural-equal";
import { generatedLanguageUpdates } from "@/views/languages/generated-language-updates";

function sourceLine(): LyricLine {
  return legacyLine({
    id: "line",
    agentId: "v1",
    text: "Hello",
    backgroundText: "안녕",
    words: [{ id: "w1", text: "Hello", sep: "", begin: 0, end: 1, transliteration: "old main", joinsNext: false }],
    backgroundWords: [
      { id: "w2", text: "안녕", sep: "", begin: 0, end: 1, transliteration: "old bg", joinsNext: false },
    ],
    transliteration: {
      language: "ko-Latn",
      text: "old main",
      backgroundText: "old bg",
      segments: [],
      origin: "google",
      sourceFingerprint: "older source",
      alignmentStatus: "needs-review",
    },
    translations: {
      en: {
        language: "en",
        text: "old translation",
        backgroundText: "old background translation",
        origin: "google",
        sourceFingerprint: "older source",
      },
    },
  });
}

function changedParts(line: LyricLine, updates: Partial<LyricLine>): Partial<LegacyLine> {
  if (!("languages" in updates)) return {};
  const before = legacyView(line);
  const after = legacyView({ ...line, languages: updates.languages });
  const parts: Partial<LegacyLine> = {};
  for (const key of ["transliteration", "translations", "words", "backgroundWords"] as const) {
    if (!isStructurallyEqual(after[key], before[key])) Object.assign(parts, { [key]: after[key] });
  }
  return parts;
}

function roman(text: string | null, failed = false): Map<string, TransliterationLineResult> {
  return new Map([["line", { id: "line", text, segments: [], ...(failed ? { failed } : {}) }]]);
}

function translation(text: string | null, failed = false): Map<string, TranslationLineResult> {
  return new Map([["line", { id: "line", text, ...(failed ? { failed } : {}) }]]);
}

describe("generated language updates", () => {
  it.each([false, true])("preserves failed tracks and word mappings with force=%s", (force) => {
    for (const failedSide of ["main", "background"]) {
      const line = sourceLine();
      const updates = generatedLanguageUpdates(line, {
        force,
        transliteration: {
          language: "ko-Latn",
          main: roman(failedSide === "main" ? null : "new main", failedSide === "main"),
          background: roman(failedSide === "background" ? null : "new bg", failedSide === "background"),
        },
        translations: [
          {
            language: "en",
            main: translation(failedSide === "main" ? null : "new main", failedSide === "main"),
            background: translation(failedSide === "background" ? null : "new bg", failedSide === "background"),
          },
          { language: "es", main: translation("Hola"), background: translation(null) },
        ],
      });

      const parts = changedParts(line, updates);
      expect(parts).not.toHaveProperty("transliteration");
      expect(parts).not.toHaveProperty("words");
      expect(parts).not.toHaveProperty("backgroundWords");
      expect(updates.languages?.translations?.en).toBe(line.languages?.translations?.en);
      expect(updates.languages?.translations?.es.main.text).toBe("Hola");
    }
  });

  it("creates background-only tracks after a successful empty main result", () => {
    const line = sourceLine();
    line.languages = undefined;
    const updates = generatedLanguageUpdates(line, {
      force: false,
      transliteration: {
        language: "en-Latn",
        backgroundLanguage: "ko-Latn",
        main: roman(null),
        background: roman("an nyeong"),
      },
      translations: [{ language: "en", main: translation(null), background: translation("Hello") }],
    });

    expect(changedParts(line, updates).transliteration).toMatchObject({
      language: "ko-Latn",
      text: "",
      backgroundText: "an nyeong",
      origin: "google",
      sourceFingerprint: languageSourceFingerprint(lineText(line), backgroundText(line)),
    });
    expect(legacyWords(roleWords(line, "main"), updates.languages)?.[0]).not.toHaveProperty("transliteration");
    expect(legacyWords(roleWords(line, "bg"), updates.languages, "bg")?.[0].transliteration).toBe("an nyeong");
    expect(legacyLanguages(updates.languages).translations?.en).toMatchObject({ text: "", backgroundText: "Hello" });
  });

  it("removes obsolete Google transliteration and word mappings on successful empty results", () => {
    const line = sourceLine();
    const updates = generatedLanguageUpdates(line, {
      force: false,
      transliteration: { language: "ko-Latn", main: roman(null), background: roman(null) },
      translations: [],
    });

    expect(changedParts(line, updates)).toHaveProperty("transliteration", undefined);
    expect(legacyWords(roleWords(line, "main"), updates.languages)?.[0]).not.toHaveProperty("transliteration");
    expect(legacyWords(roleWords(line, "bg"), updates.languages, "bg")?.[0]).not.toHaveProperty("transliteration");
  });

  it("removes the background readings held beside a main-only Google transliteration with it", () => {
    const { translations: _translations, ...source } = legacyView(sourceLine());
    const line = legacyLine({
      ...source,
      transliteration: {
        language: "ko-Latn",
        text: "old main",
        segments: [],
        origin: "google",
        sourceFingerprint: "x",
      },
    });
    expect(legacyWords(roleWords(line, "bg"), line.languages, "bg")?.[0]).toHaveProperty("transliteration", "old bg");

    const updates = generatedLanguageUpdates(line, {
      force: false,
      transliteration: { language: "ko-Latn", main: roman(null), background: roman(null) },
      translations: [],
    });

    expect(updates).toEqual({ languages: undefined });
  });

  it("removes obsolete Google translations on successful empty results", () => {
    const updates = generatedLanguageUpdates(sourceLine(), {
      force: false,
      translations: [{ language: "en", main: translation(null), background: translation(null) }],
    });

    expect(updates.languages?.translations).not.toHaveProperty("en");
  });

  it("removes obsolete Google translations for lines that were not sent, such as empty lines", () => {
    const updates = generatedLanguageUpdates(sourceLine(), {
      force: false,
      translations: [{ language: "en", main: new Map(), background: new Map() }],
    });

    expect(updates.languages?.translations).not.toHaveProperty("en");
  });

  it("keeps a stale manual translation on successful empty results", () => {
    const line = sourceLine();
    line.languages!.translations!.en.origin = "manual";
    const updates = generatedLanguageUpdates(line, {
      force: false,
      translations: [{ language: "en", main: translation(null), background: translation(null) }],
    });

    expect(legacyLanguages(updates.languages).translations?.en).toMatchObject({ text: "old translation", stale: true });
  });

  it("preserves manual tracks unless replacement was requested", () => {
    const line = sourceLine();
    line.languages!.transliteration!.origin = "manual";
    line.languages!.translations!.en.origin = "manual";
    const options = {
      transliteration: { language: "ko-Latn", main: roman(null), background: roman("an nyeong") },
      translations: [{ language: "en", main: translation(null), background: translation("Hello") }],
    };
    const preserved = generatedLanguageUpdates(line, { ...options, force: false });
    expect(preserved.languages?.transliteration?.main.text).toBe("old main");
    expect(preserved.languages?.translations?.en.main.text).toBe("old translation");

    const replaced = generatedLanguageUpdates(line, { ...options, force: true });
    expect(replaced.languages?.transliteration?.main.text).toBe("");
    expect(replaced.languages?.transliteration?.bg?.text).toBe("an nyeong");
    expect(legacyLanguages(replaced.languages).translations?.en).toMatchObject({
      text: "",
      backgroundText: "Hello",
      origin: "google",
    });
  });

  describe("regressions", () => {
    it("regression: returns no update when every request failed", () => {
      const updates = generatedLanguageUpdates(sourceLine(), {
        force: false,
        transliteration: { language: "ko-Latn", main: roman(null, true), background: roman(null, true) },
        translations: [{ language: "en", main: translation(null, true), background: translation(null, true) }],
      });

      expect(updates).toEqual({});
    });

    it("regression: leaves a manual track already marked stale untouched when Google has no new text", () => {
      const line = sourceLine();
      line.languages!.translations!.en.origin = "manual";
      line.languages!.translations!.en.stale = true;
      const updates = generatedLanguageUpdates(line, {
        force: false,
        translations: [{ language: "en", main: translation(null), background: translation(null) }],
      });

      expect(updates).toEqual({});
    });

    it("regression: returns no update when Google repeats the results the line already holds", () => {
      const generation = {
        force: false,
        transliteration: { language: "ko-Latn", main: roman("hello"), background: roman("an nyeong") },
        translations: [{ language: "en", main: translation("Hello"), background: translation("Hi") }],
      };
      const [generated] = applyLineUpdates(
        [sourceLine()],
        [{ id: "line", updates: generatedLanguageUpdates(sourceLine(), generation) }],
      );

      expect(generatedLanguageUpdates(generated, generation)).toStrictEqual({});
    });

    it("regression: returns no update for a line without transliteration when Google has none", () => {
      const source = sourceLine();
      const line = { ...source, languages: { translations: source.languages?.translations } };
      const updates = generatedLanguageUpdates(line, {
        force: false,
        transliteration: { language: "en", main: roman(null), background: roman(null) },
        translations: [],
      });

      expect(updates).toStrictEqual({});
    });
  });
});
