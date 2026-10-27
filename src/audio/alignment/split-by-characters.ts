import type { AlignmentSegment } from "@/audio/alignment/types";
import type { WordInterval } from "@/domain/alignment/words";

// -- Functions ----------------------------------------------------------------

// Splits the tapped line across its parts by character count: the fallback for
// lines the model can't place, and the baseline it has to beat.
function splitByCharacters({ words, taps }: Pick<AlignmentSegment, "words" | "taps">): WordInterval[] {
  const parts = words.flatMap((word) => word.parts);
  const totalChars = parts.reduce((sum, part) => sum + part.length, 0) || 1;
  const duration = taps.end - taps.begin;
  const intervals: WordInterval[] = [];
  let at = taps.begin;
  for (const part of parts) {
    const end = at + (duration * part.length) / totalChars;
    intervals.push({ begin: at, end });
    at = end;
  }
  return intervals;
}

// -- Exports ------------------------------------------------------------------

export { splitByCharacters };
