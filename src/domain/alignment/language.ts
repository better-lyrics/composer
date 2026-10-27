import { hasKana } from "@/domain/alignment/cjk";
import type { LyricLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

/** Whether Han characters are read as Mandarin or as Japanese kanji. */
type HanReading = "zh" | "ja";

// -- Constants ----------------------------------------------------------------

// The model covers English, Mandarin and Japanese, mixed freely within a line.
// With no project language set, each line is tried; lines in other scripts
// fall back to the character split.
const SUPPORTED_LANGUAGES = new Set(["en", "zh", "cmn", "ja"]);

// -- Functions ----------------------------------------------------------------

function isSupportedLanguage(language: string | undefined): boolean {
  return !language || SUPPORTED_LANGUAGES.has(language.toLowerCase().split("-")[0]);
}

// Han characters are kanji in a Japanese project, or when any line has kana
// (an all-kanji line in a Japanese song would otherwise read as Mandarin).
function hanReadingFor(language: string | undefined, lines: readonly LyricLine[]): HanReading {
  const base = language?.toLowerCase().split("-")[0];
  if (base === "ja") return "ja";
  if (base === "zh" || base === "cmn") return "zh";
  return lines.some((line) => hasKana(line.text)) ? "ja" : "zh";
}

// -- Exports ------------------------------------------------------------------

export { hanReadingFor, isSupportedLanguage };
export type { HanReading };
