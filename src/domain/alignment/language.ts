import { hasKana } from "@/domain/alignment/cjk";
import { detectNonLatinLanguage, hasLatinLetter } from "@/domain/language/script-detection";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

/** Whether Han characters are read as Mandarin or as Japanese kanji. */
type HanReading = "zh" | "ja";

// -- Constants ----------------------------------------------------------------

// The model covers English, Mandarin and Japanese, mixed freely within a line.
// With no project language set, each line is tried; lines in other scripts
// fall back to the character split.
const SUPPORTED_LANGUAGES = new Set(["en", "zh", "ja"]);

// -- Functions ----------------------------------------------------------------

/** The primary subtag, lowercased, with Mandarin's `cmn` read as `zh`. Null when empty. */
function baseLanguage(tag: string | undefined): string | null {
  const base = tag?.toLowerCase().split("-")[0];
  if (!base) return null;
  return base === "cmn" ? "zh" : base;
}

function isAlignableLanguage(code: string): boolean {
  const base = baseLanguage(code);
  return base !== null && SUPPORTED_LANGUAGES.has(base);
}

// A song with no language set is never blocked: each line is tried.
function canAlignLanguage(language: string | undefined, modelLanguages: readonly string[]): boolean {
  const base = baseLanguage(language);
  return !base || (SUPPORTED_LANGUAGES.has(base) && coversLanguage(modelLanguages, base));
}

// Han characters are kanji in a Japanese project, or when any line has kana
// (an all-kanji line in a Japanese song would otherwise read as Mandarin).
function hanReadingFor(language: string | undefined, lines: readonly LyricLine[]): HanReading {
  const base = baseLanguage(language);
  if (base === "ja" || base === "zh") return base;
  return lines.some((line) => hasKana(line.text)) ? "ja" : "zh";
}

// The project language when set, else a guess from the lyrics' script. Kana
// anywhere wins over Han, as in `hanReadingFor`.
function songLanguage(language: string | undefined, lines: readonly Pick<LyricLine, "text">[]): string | null {
  const base = baseLanguage(language);
  if (base) return base;
  const text = lines.map((line) => line.text).join("\n");
  return detectNonLatinLanguage(text) ?? (hasLatinLetter(text) ? "en" : null);
}

function coversLanguage(languages: readonly string[], code: string): boolean {
  return languages.some((language) => baseLanguage(language) === code);
}

/** Every language the lists cover, once each, in first-seen order with the song's first. */
function coverageColumns(languageLists: readonly (readonly string[])[], song: string | null): string[] {
  const columns = new Set<string>();
  for (const language of languageLists.flat()) {
    const base = baseLanguage(language);
    if (base) columns.add(base);
  }
  if (!song || !columns.has(song)) return [...columns];
  return [song, ...[...columns].filter((code) => code !== song)];
}

// -- Exports ------------------------------------------------------------------

export {
  baseLanguage,
  canAlignLanguage,
  coverageColumns,
  coversLanguage,
  hanReadingFor,
  isAlignableLanguage,
  songLanguage,
};
export type { HanReading };
