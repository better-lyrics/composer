import { alignTrackToLine } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TransliterationTrack } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";
import type { TranslationLineResult, TransliterationLineResult } from "@/services/language-provider";
import { isStructurallyEqual } from "@/utils/structural-equal";

interface TransliterationGeneration {
  language: string;
  backgroundLanguage?: string;
  main: ReadonlyMap<string, TransliterationLineResult>;
  background: ReadonlyMap<string, TransliterationLineResult>;
}

interface TranslationGeneration {
  language: string;
  main: ReadonlyMap<string, TranslationLineResult>;
  background: ReadonlyMap<string, TranslationLineResult>;
}

interface GeneratedLanguageOptions {
  force: boolean;
  transliteration?: TransliterationGeneration;
  translations: TranslationGeneration[];
}

function generatedLanguageUpdates(
  line: LyricLine,
  { force, transliteration: generatedRoman, translations: generatedTranslations }: GeneratedLanguageOptions,
): Partial<LyricLine> {
  const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
  const updates: Partial<LyricLine> = {};

  const result = generatedRoman?.main.get(line.id);
  const backgroundResult = generatedRoman?.background.get(line.id);
  // Track metadata describes both sides. Commit them together so a failed
  // request cannot erase content or make an older side appear freshly generated.
  if (generatedRoman && !result?.failed && !backgroundResult?.failed) {
    const current = line.transliteration;
    const mayReplace = force || !current || current.origin === "google";
    let transliteration: TransliterationTrack | undefined = current;
    if (mayReplace && (result?.text || backgroundResult?.text)) {
      const generated: TransliterationTrack = {
        language: result?.text
          ? generatedRoman.language
          : (generatedRoman.backgroundLanguage ?? generatedRoman.language),
        text: result?.text ?? "",
        backgroundText: backgroundResult?.text ?? undefined,
        segments: result?.segments ?? [],
        backgroundSegments: backgroundResult?.segments,
        origin: "google",
        sourceFingerprint: fingerprint,
      };
      const unchanged =
        !force &&
        current &&
        isStructurallyEqual(
          { ...current, alignmentStatus: undefined, backgroundAlignmentStatus: undefined },
          generated,
        );
      transliteration = unchanged ? current : generated;
    } else if (mayReplace && current?.origin === "google") {
      transliteration = undefined;
    } else if (current && current.sourceFingerprint !== fingerprint) {
      transliteration = { ...current, stale: true };
    } else if (current?.stale) {
      const { stale: _stale, ...fresh } = current;
      transliteration = fresh;
    }
    // Re-aligning an unchanged track would reset its review status; Regenerate still re-aligns.
    if (force || transliteration !== current) {
      if (transliteration) {
        Object.assign(updates, alignTrackToLine(line, transliteration));
      } else {
        if (current) {
          Object.assign(updates, alignTrackToLine(line, { ...current, text: "", backgroundText: undefined }));
        }
        updates.transliteration = undefined;
      }
    }
  }

  if (generatedTranslations.length > 0) {
    const translations = { ...(line.translations ?? {}) };
    for (const generated of generatedTranslations) {
      const result = generated.main.get(line.id);
      const backgroundResult = generated.background.get(line.id);
      if (result?.failed || backgroundResult?.failed) continue;
      const current = translations[generated.language];
      const mayReplace = force || !current || current.origin === "google";
      if (mayReplace && (result?.text || backgroundResult?.text)) {
        translations[generated.language] = {
          language: generated.language,
          text: result?.text ?? "",
          backgroundText: backgroundResult?.text ?? undefined,
          origin: "google",
          sourceFingerprint: fingerprint,
        };
      } else if (mayReplace && current?.origin === "google") {
        // The provider returns null for untranslatable or unchanged text; an
        // old Google translation of different source text is no longer valid.
        delete translations[generated.language];
      } else if (current && current.sourceFingerprint !== fingerprint) {
        if (!current.stale) translations[generated.language] = { ...current, stale: true };
      } else if (current?.stale) {
        const { stale: _stale, ...fresh } = current;
        translations[generated.language] = fresh;
      }
    }
    const changed = generatedTranslations.some(
      ({ language }) => translations[language] !== line.translations?.[language],
    );
    if (changed) updates.translations = translations;
  }

  // Google repeats unchanged results on every visit; an unchanged write would still cost a history step.
  for (const key of Object.keys(updates) as (keyof LyricLine)[]) {
    if (isStructurallyEqual(updates[key], line[key])) delete updates[key];
  }
  return updates;
}

export { generatedLanguageUpdates };
export type { TranslationGeneration, TransliterationGeneration };
