import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type BoundaryEdge = "begin" | "end";

interface BoundaryClampInput {
  words: readonly WordTiming[];
  wordIndex: number;
  edge: BoundaryEdge;
  time: number;
  minDuration: number;
  rollNeighbour: boolean;
  duration?: number;
}

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

// -- Clamp --------------------------------------------------------------------

// A pair spanning under twice minDuration cannot satisfy both floors, so the hard
// ceiling gives up the minimum rather than letting either word invert.
function clampBoundaryTime({
  words,
  wordIndex,
  edge,
  time,
  minDuration,
  rollNeighbour,
  duration,
}: BoundaryClampInput): number {
  const word = words[wordIndex];
  if (!word) return time;

  if (edge === "begin") {
    const prev = words[wordIndex - 1];
    const floor = rollNeighbour && prev ? prev.begin + minDuration : (prev?.end ?? 0);
    return Math.min(word.end, Math.max(floor, Math.min(word.end - minDuration, time)));
  }

  const next = words[wordIndex + 1];
  const neighbourCeiling = rollNeighbour && next ? next.end : (next?.begin ?? Number.POSITIVE_INFINITY);
  const hardCeiling = Math.max(word.begin, Math.min(neighbourCeiling, duration ?? Number.POSITIVE_INFINITY));
  const ceiling = rollNeighbour && next ? next.end - minDuration : hardCeiling;
  return Math.min(hardCeiling, Math.max(word.begin + minDuration, Math.min(ceiling, time)));
}

// -- Exports ------------------------------------------------------------------

export { clampBoundaryTime, isBoundaryFlush };
export type { BoundaryEdge };
