import type { AlignmentSegment } from "@/audio/alignment/types";
import type { WordInterval } from "@/domain/alignment/words";

// -- Functions ----------------------------------------------------------------

// Splits the tapped line by character count: the fallback for lines the model
// can't place, and the baseline it has to beat.
function splitByCharacters({ words, taps }: Pick<AlignmentSegment, "words" | "taps">): WordInterval[] {
  const totalChars = words.reduce((sum, word) => sum + word.length, 0) || 1;
  const duration = taps.end - taps.begin;
  const intervals: WordInterval[] = [];
  let at = taps.begin;
  for (const word of words) {
    const end = at + (duration * word.length) / totalChars;
    intervals.push({ begin: at, end });
    at = end;
  }
  return intervals;
}

// -- Exports ------------------------------------------------------------------

export { splitByCharacters };
