import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { mainTrack, timedSyllables } from "@/domain/line/track";

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
    timedSyllables(mainTrack(line))
      .map((word) => word.transliteration ?? "")
      .join(" ")
      .trim();
  if (!text || comparable(text) === comparable(lineText(line))) return null;
  return text;
}

// -- Exports ------------------------------------------------------------------

export { sungTransliteration };
