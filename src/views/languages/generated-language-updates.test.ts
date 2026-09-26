import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LyricLine } from "@/domain/line/model";
import type { TranslationLineResult, TransliterationLineResult } from "@/services/language-provider";
import { generatedLanguageUpdates } from "@/views/languages/generated-language-updates";
import { describe, expect, it } from "vitest";

function sourceLine(): LyricLine {
  return {
    id: "line",
    agentId: "v1",
    text: "Hello",
    backgroundText: "안녕",
    words: [{ text: "Hello", begin: 0, end: 1, transliteration: "old main" }],
    backgroundWords: [{ text: "안녕", begin: 0, end: 1, transliteration: "old bg" }],
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
  };
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

      expect(updates).not.toHaveProperty("transliteration");
      expect(updates).not.toHaveProperty("words");
      expect(updates).not.toHaveProperty("backgroundWords");
      expect(updates.translations?.en).toBe(line.translations?.en);
      expect(updates.translations?.es.text).toBe("Hola");
    }
  });

  it("creates background-only tracks after a successful empty main result", () => {
    const line = sourceLine();
    line.transliteration = undefined;
    line.translations = undefined;
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

    expect(updates.transliteration).toMatchObject({
      language: "ko-Latn",
      text: "",
      backgroundText: "an nyeong",
      origin: "google",
      sourceFingerprint: languageSourceFingerprint(line.text, line.backgroundText),
    });
    expect(updates.words?.[0]).not.toHaveProperty("transliteration");
    expect(updates.backgroundWords?.[0].transliteration).toBe("an nyeong");
    expect(updates.translations?.en).toMatchObject({ text: "", backgroundText: "Hello" });
  });

  it("removes obsolete Google transliteration and word mappings on successful empty results", () => {
    const updates = generatedLanguageUpdates(sourceLine(), {
      force: false,
      transliteration: { language: "ko-Latn", main: roman(null), background: roman(null) },
      translations: [],
    });

    expect(updates).toHaveProperty("transliteration", undefined);
    expect(updates.words?.[0]).not.toHaveProperty("transliteration");
    expect(updates.backgroundWords?.[0]).not.toHaveProperty("transliteration");
  });

  it("preserves manual tracks unless replacement was requested", () => {
    const line = sourceLine();
    line.transliteration!.origin = "manual";
    line.translations!.en.origin = "manual";
    const options = {
      transliteration: { language: "ko-Latn", main: roman(null), background: roman("an nyeong") },
      translations: [{ language: "en", main: translation(null), background: translation("Hello") }],
    };
    const preserved = generatedLanguageUpdates(line, { ...options, force: false });
    expect(preserved.transliteration?.text).toBe("old main");
    expect(preserved.translations?.en.text).toBe("old translation");

    const replaced = generatedLanguageUpdates(line, { ...options, force: true });
    expect(replaced.transliteration?.text).toBe("");
    expect(replaced.transliteration?.backgroundText).toBe("an nyeong");
    expect(replaced.translations?.en).toMatchObject({ text: "", backgroundText: "Hello", origin: "google" });
  });
});
