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

// Lines are grouped by the exact tracks they hold, so a refresh never adds a track a line does not have.
function staleGeneratedLanguages(lines: readonly LyricLine[]): StaleGeneratedLanguages[] {
  const groups = new Map<string, StaleGeneratedLanguages>();
  for (const line of lines) {
    const fingerprint = languageSourceFingerprint(line.text, line.backgroundText);
    const transliteration = isStaleGenerated(line.transliteration, fingerprint);
    const translations = Object.entries(line.translations ?? {})
      .flatMap(([language, track]) => (isStaleGenerated(track, fingerprint) ? [language] : []))
      .toSorted();
    if (!transliteration && translations.length === 0) continue;
    const key = `${transliteration}\u0000${translations.join("\u0000")}`;
    const group = groups.get(key);
    if (group) group.lineIds.push(line.id);
    else groups.set(key, { lineIds: [line.id], transliteration, translations });
  }
  return [...groups.values()];
}

// -- Exports ------------------------------------------------------------------

export { staleGeneratedLanguages };
export type { StaleGeneratedLanguages };
