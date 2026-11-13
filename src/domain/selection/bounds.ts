import type { LyricLine } from "@/domain/line/model";
import type { SyllableAddress } from "@/domain/selection/model";
import { wordAt } from "@/domain/selection/resolve";
import type { Bounds } from "@/domain/word/bounds";

// -- Functions ----------------------------------------------------------------

function selectionBounds(lines: readonly LyricLine[], selections: readonly SyllableAddress[]): Bounds | null {
  let begin = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const selection of selections) {
    const word = wordAt(lines, selection);
    if (!word) continue;
    begin = Math.min(begin, word.begin);
    end = Math.max(end, word.end);
  }
  return begin <= end ? { begin, end } : null;
}

// -- Exports ------------------------------------------------------------------

export { selectionBounds };
