import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LanguageContentMeta } from "@/domain/language/model";
import type { LyricLine } from "@/domain/line/model";

// -- Interfaces ---------------------------------------------------------------

interface StaleGeneratedLanguages {
  lineIds: string[];
  transliteration: boolean;
  translations: string[];
}

// -- Functions ----------------------------------------------------------------

function isStaleGenerated(track: LanguageContentMeta | undefined, fingerprint: string): boolean {
  return track?.origin === "google" && track.sourceFingerprint !== fingerprint;
}

function staleGeneratedLanguages(lines: readonly LyricLine[]): StaleGeneratedLanguages | null {
  const lineIds: string[] = [];
  const translations = new Set<string>();
  let transliteration = false;
  for (const line of lines) {
    const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
    const staleTransliteration = isStaleGenerated(line.transliteration, fingerprint);
    const staleTranslations = Object.entries(line.translations ?? {}).flatMap(([language, track]) =>
      isStaleGenerated(track, fingerprint) ? [language] : [],
    );
    if (!staleTransliteration && staleTranslations.length === 0) continue;
    lineIds.push(line.id);
    transliteration ||= staleTransliteration;
    for (const language of staleTranslations) translations.add(language);
  }
  return lineIds.length > 0 ? { lineIds, transliteration, translations: [...translations] } : null;
}

// -- Exports ------------------------------------------------------------------

export { staleGeneratedLanguages };
export type { StaleGeneratedLanguages };
