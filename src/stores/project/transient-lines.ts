import type { LyricLine } from "@/domain/line/model";

// -- State --------------------------------------------------------------------

const transientLineArrays = new WeakSet<readonly LyricLine[]>();

// -- Functions ----------------------------------------------------------------

function markTransientLines(lines: readonly LyricLine[]): void {
  transientLineArrays.add(lines);
}

function isTransientLines(lines: readonly LyricLine[]): boolean {
  return transientLineArrays.has(lines);
}

// -- Exports ------------------------------------------------------------------

export { isTransientLines, markTransientLines };
