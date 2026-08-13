import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type BoundaryEdge = "begin" | "end";

// -- Predicates ---------------------------------------------------------------

// Overlaps count as flush, preserving the drag path's original `prev.end < word.begin` test.
function isBoundaryFlush(words: readonly WordTiming[], wordIndex: number, edge: BoundaryEdge): boolean {
  const word = words[wordIndex];
  if (!word) return false;
  if (edge === "begin") {
    const prev = words[wordIndex - 1];
    return prev !== undefined && prev.end >= word.begin;
  }
  const next = words[wordIndex + 1];
  return next !== undefined && next.begin <= word.end;
}

// -- Exports ------------------------------------------------------------------

export { isBoundaryFlush };
export type { BoundaryEdge };
