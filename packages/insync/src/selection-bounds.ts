import type { LyricLine } from "./line";
import type { SyllableAddress } from "./selection-model";
import { wordAt } from "./selection-resolve";
import type { Bounds } from "./word-bounds";

// -- Functions ----------------------------------------------------------------

function selectionBounds(
  lines: readonly LyricLine[],
  selections: readonly SyllableAddress[],
  splitChar: string,
): Bounds | null {
  let begin = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const selection of selections) {
    const word = wordAt(lines, selection, splitChar);
    if (!word) continue;
    begin = Math.min(begin, word.begin);
    end = Math.max(end, word.end);
  }
  return begin <= end ? { begin, end } : null;
}

// -- Exports ------------------------------------------------------------------

export { selectionBounds };
