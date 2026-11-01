import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

function comparable(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

/**
 * The line's romanization, used as what's actually sung: lyrics-specific
 * readings (運命 as "sadame") beat the dictionaries. Lines whose
 * "transliteration" is just the line again (English lines in a Japanese
 * song) use the dictionaries, as do stale transliterations of edited lyrics.
 */
function sungTransliteration(line: LyricLine): string | null {
  const track = line.transliteration;
  if (!track || track.stale) return null;
  const text =
    track.text?.trim() ||
    line.words
      ?.map((word) => word.transliteration ?? "")
      .join(" ")
      .trim();
  if (!text || comparable(text) === comparable(line.text)) return null;
  return text;
}

// -- Exports ------------------------------------------------------------------

export { sungTransliteration };
