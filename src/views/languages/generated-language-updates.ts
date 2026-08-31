import { alignTrackToLine } from "@/domain/language/align";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { TransliterationTrack } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";
import type { TransliterationLineResult } from "@/services/language-provider";

interface TransliterationGeneration {
  language: string;
  main: ReadonlyMap<string, TransliterationLineResult>;
  background: ReadonlyMap<string, TransliterationLineResult>;
}

interface TranslationGeneration {
  language: string;
  main: ReadonlyMap<string, string | null>;
  background: ReadonlyMap<string, string | null>;
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

  if (generatedRoman) {
    const current = line.transliteration;
    const mayReplace = force || !current || current.origin === "google";
    const result = generatedRoman.main.get(line.id);
    const backgroundResult = generatedRoman.background.get(line.id);
    let transliteration: TransliterationTrack | undefined = current;
    if (mayReplace && result?.text) {
      transliteration = {
        language: generatedRoman.language,
        text: result.text,
        backgroundText: backgroundResult?.text ?? undefined,
        segments: result.segments,
        backgroundSegments: backgroundResult?.segments,
        origin: "google",
        sourceFingerprint: fingerprint,
      };
    } else if (mayReplace && current?.origin === "google") {
      transliteration = undefined;
    } else if (current && current.sourceFingerprint !== fingerprint) {
      transliteration = { ...current, stale: true };
    } else if (current?.stale) {
      const { stale: _stale, ...fresh } = current;
      transliteration = fresh;
    }
    Object.assign(updates, transliteration ? alignTrackToLine(line, transliteration) : { transliteration: undefined });
  }

  if (generatedTranslations.length > 0) {
    const translations = { ...(line.translations ?? {}) };
    for (const generated of generatedTranslations) {
      const current = translations[generated.language];
      const mayReplace = force || !current || current.origin === "google";
      const text = generated.main.get(line.id);
      if (mayReplace && text) {
        translations[generated.language] = {
          language: generated.language,
          text,
          backgroundText: generated.background.get(line.id) ?? undefined,
          origin: "google",
          sourceFingerprint: fingerprint,
        };
      } else if (current && current.sourceFingerprint !== fingerprint) {
        translations[generated.language] = { ...current, stale: true };
      } else if (current?.stale) {
        const { stale: _stale, ...fresh } = current;
        translations[generated.language] = fresh;
      }
    }
    updates.translations = translations;
  }

  return updates;
}

export { generatedLanguageUpdates };
