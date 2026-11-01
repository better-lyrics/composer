import { holdsEveryLine } from "@/domain/line/edited-ttml-lines";
import type { LyricLine } from "@/domain/line/model";
import { mergeEditedExport, ownExportLines } from "@/test/edited-ttml";
import { createLine } from "@/test/factories";
import { describe, expect, it } from "vitest";

// -- Constants ----------------------------------------------------------------

const SPANISH = { language: "es", text: "Hola", origin: "manual" as const, sourceFingerprint: "fp-1" };

// -- Helpers ------------------------------------------------------------------

function withSpanish(id: string, text: string, begin: number): LyricLine {
  return { ...createLine({ id, text, begin, end: begin + 1 }), translations: { es: SPANISH } };
}

function clearedTranslationField(line: LyricLine, language: string): LyricLine {
  const translations = { ...(line.translations ?? {}) };
  delete translations[language];
  return { ...line, translations };
}

function removedTargetLanguage(lines: LyricLine[], language: string): LyricLine[] {
  return lines.map((line) => {
    if (!line.translations?.[language]) return line;
    const translations = { ...line.translations };
    delete translations[language];
    return { ...line, translations };
  });
}

// -- Tests --------------------------------------------------------------------

describe("mergeEditedTtmlLines · language tracks", () => {
  describe("regressions", () => {
    it("regression: keeps a translation's origin when its text did not change", () => {
      const stored = [{ ...createLine({ id: "a", text: "Hello", begin: 1, end: 2 }), translations: { es: SPANISH } }];
      expect(mergeEditedExport(stored)[0]?.translations?.es).toEqual(SPANISH);
    });

    it("regression: takes an edited translation as the TTML gives it", () => {
      const stored = [{ ...createLine({ id: "a", text: "Hello", begin: 1, end: 2 }), translations: { es: SPANISH } }];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Hola<", ">Buenas<"));
      expect(merged[0]?.translations?.es?.text).toBe("Buenas");
    });
  });

  describe("regressions: empty language tracks", () => {
    const EMPTY_FRENCH = { language: "fr", text: "", origin: "manual" as const, sourceFingerprint: "fp-2" };
    const EMPTY_ROMAJI = {
      language: "ja-Latn",
      text: "",
      origin: "manual" as const,
      sourceFingerprint: "fp-3",
      segments: [],
    };

    it("regression: keeps an empty translation track the export leaves out", () => {
      const stored = [
        {
          ...createLine({ id: "a", text: "Hello", begin: 1, end: 2 }),
          translations: { es: SPANISH, fr: EMPTY_FRENCH },
        },
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Hello<", ">Hello there<"));
      expect(merged[0]?.translations).toEqual({ es: SPANISH, fr: EMPTY_FRENCH });
    });

    it("regression: keeps empty translation tracks on a line with no other translation", () => {
      const stored = [
        { ...createLine({ id: "a", text: "Hello", begin: 1, end: 2 }), translations: { fr: EMPTY_FRENCH } },
      ];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Hello<", ">Hello there<"));
      expect(merged[0]?.translations).toEqual({ fr: EMPTY_FRENCH });
    });

    it("regression: keeps an empty transliteration track the export leaves out", () => {
      const stored = [{ ...createLine({ id: "a", text: "Hello", begin: 1, end: 2 }), transliteration: EMPTY_ROMAJI }];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Hello<", ">Hello there<"));
      expect(merged[0]?.transliteration).toEqual(EMPTY_ROMAJI);
    });

    it("drops a translation the edit removed", () => {
      const stored = [{ ...createLine({ id: "a", text: "Hello", begin: 1, end: 2 }), translations: { es: SPANISH } }];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(/<iTunesMetadata[\s\S]*<\/iTunesMetadata>/, ""));
      expect(merged[0]?.translations).toBeUndefined();
    });
  });

  describe("regressions: translations removed in Languages", () => {
    it("regression: holds a line whose last translation field was cleared", () => {
      const stored = [clearedTranslationField(withSpanish("a", "Hello", 1), "es"), withSpanish("b", "World", 2)];
      expect(stored[0]?.translations).toEqual({});
      expect(holdsEveryLine(stored, ownExportLines(stored))).toBe(true);
    });

    it("regression: holds lines after their only target language was removed", () => {
      const stored = removedTargetLanguage([withSpanish("a", "Hello", 1), withSpanish("b", "World", 2)], "es");
      expect(stored.map((line) => line.translations)).toEqual([{}, {}]);
      expect(holdsEveryLine(stored, ownExportLines(stored))).toBe(true);
    });

    it("regression: an edited line keeps its empty translations as stored", () => {
      const stored = [clearedTranslationField(withSpanish("a", "Hello", 1), "es")];
      const merged = mergeEditedExport(stored, (ttml) => ttml.replace(">Hello<", ">Hello there<"));
      expect(merged[0]?.text).toBe("Hello there");
      expect(merged[0]?.translations).toEqual({});
    });
  });
});
