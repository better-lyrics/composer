import { lineTransliteration } from "insync/language-line-languages";
import { pieceOf } from "insync/language-pieces";
import type { LyricLine } from "insync/line";
import { lineText } from "insync/line-text";
import { mainTrack, timedSyllables } from "insync/line-track";
import { getSplitCharacter } from "@/utils/split-character";

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
  const track = lineTransliteration(line);
  if (!track || track.stale) return null;
  const text =
    track.main.text?.trim() ||
    timedSyllables(mainTrack(line))
      .map((word) => pieceOf(track.main.pieces, word)?.text ?? "")
      .join(" ")
      .trim();
  if (!text || comparable(text) === comparable(lineText(line, getSplitCharacter()))) return null;
  return text;
}

// -- Exports ------------------------------------------------------------------

export { sungTransliteration };
