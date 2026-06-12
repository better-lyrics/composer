import type { Bounds } from "@/domain/word/bounds";

// -- Functions ----------------------------------------------------------------

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.begin < b.end && a.end > b.begin;
}

// -- Exports ------------------------------------------------------------------

export { boundsOverlap };
