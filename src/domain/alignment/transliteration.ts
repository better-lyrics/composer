import type { LyricLine } from "@/domain/line/model";
import { type WordTrack, trackWords } from "@/domain/line/tracks";

// -- Functions ----------------------------------------------------------------

function comparable(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

/**
 * The romanization of a line's lyrics or its background vocals, used as what's
 * actually sung: lyrics-specific readings (運命 as "sadame") beat the
 * dictionaries. Lines whose "transliteration" is just the line again (English
 * lines in a Japanese song) use the dictionaries, as do stale transliterations
 * of edited lyrics.
 */
function sungTransliteration(line: LyricLine, type: WordTrack = "word"): string | null {
  const track = line.transliteration;
  if (!track || track.stale) return null;
  const sung = type === "word" ? line.text : (line.backgroundText ?? "");
  const text =
    (type === "word" ? track.text : track.backgroundText)?.trim() ||
    trackWords(line, type)
      ?.map((word) => word.transliteration ?? "")
      .join(" ")
      .trim();
  if (!text || comparable(text) === comparable(sung)) return null;
  return text;
}

// -- Exports ------------------------------------------------------------------

export { sungTransliteration };
