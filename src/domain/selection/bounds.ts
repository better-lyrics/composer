import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import type { Bounds } from "@/domain/word/bounds";

// -- Functions ----------------------------------------------------------------

function selectionBounds(lines: readonly LyricLine[], selections: readonly WordSelection[]): Bounds | null {
  const linesById = new Map(lines.map((line) => [line.id, line]));
  let begin = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const selection of selections) {
    const line = linesById.get(selection.lineId);
    const word = line ? effectiveTrackWords(line, selection.type)?.[selection.wordIndex] : undefined;
    if (!word) continue;
    begin = Math.min(begin, word.begin);
    end = Math.max(end, word.end);
  }
  return begin <= end ? { begin, end } : null;
}

// -- Exports ------------------------------------------------------------------

export { selectionBounds };
