import { hasKana } from "@/domain/alignment/cjk";
import { detectNonLatinLanguage, hasLatinLetter } from "@/domain/language/script-detection";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

/** Whether Han characters are read as Mandarin or as Japanese kanji. */
type HanReading = "zh" | "ja";

/** A language whose own spelling rules read the Latin-script words of a song set to it. Malay reads as Indonesian. */
type LatinReader = "es" | "pt" | "fr" | "de" | "it" | "tr" | "id";

/** How a song's scripts are read for alignment. */
interface LineReading {
  hanReading: HanReading;
  /** Null when Latin-script words are read as English. */
  latinReader: LatinReader | null;
}

// -- Constants ----------------------------------------------------------------

const LATIN_READERS: Readonly<Record<string, LatinReader>> = {
  es: "es",
  pt: "pt",
  fr: "fr",
  de: "de",
  it: "it",
  tr: "tr",
  id: "id",
  ms: "id",
};
// English, Mandarin and Japanese read from dictionaries, mixed freely within a
// line; the rest through a language reader. A model's manifest can claim only
// these. Every line is tried whatever the song language; lines in other scripts
// fall back to the character split.
const SUPPORTED_LANGUAGES = new Set(["en", "zh", "ja", "ko", "ar", ...Object.keys(LATIN_READERS)]);

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

// Han characters are kanji in a Japanese project, or when any line has kana
// (an all-kanji line in a Japanese song would otherwise read as Mandarin).
function hanReadingFor(language: string | undefined, lines: readonly Pick<LyricLine, "text">[]): HanReading {
  const base = baseLanguage(language);
  if (base === "ja" || base === "zh") return base;
  return lines.some((line) => hasKana(line.text)) ? "ja" : "zh";
}

// Only the project language picks a Latin reader: a song with none set, or set to a
// language in another script, reads its Latin-script words as English.
function lineReadingFor(language: string | undefined, lines: readonly Pick<LyricLine, "text">[]): LineReading {
  const base = baseLanguage(language);
  return { hanReading: hanReadingFor(language, lines), latinReader: base ? (LATIN_READERS[base] ?? null) : null };
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
  coverageColumns,
  coversLanguage,
  isAlignableLanguage,
  lineReadingFor,
  songLanguage,
};
export type { HanReading, LatinReader, LineReading };
