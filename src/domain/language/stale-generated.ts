import { backgroundText, lineText } from "@/domain/line/text";
import { languageSourceFingerprint } from "@/domain/language/fingerprint";
import type { LanguageContentMeta } from "insync/language";
import { lineTranslations, lineTransliteration } from "@/domain/language/line-languages";
import type { LyricLine } from "insync/line";

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
function staleGeneratedLanguages(lines: readonly LyricLine[], splitChar: string): StaleGeneratedLanguages[] {
  const groups = new Map<string, StaleGeneratedLanguages>();
  for (const line of lines) {
    const fingerprint = languageSourceFingerprint(
      splitChar,
      lineText(line, splitChar),
      backgroundText(line, splitChar),
    );
    const transliteration = isStaleGenerated(lineTransliteration(line), fingerprint);
    const translations = Object.entries(lineTranslations(line) ?? {})
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
