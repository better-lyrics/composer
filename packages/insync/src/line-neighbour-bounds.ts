import { effectiveBounds } from "./line-bounds";
import type { LyricLine } from "./line";

// -- Functions ----------------------------------------------------------------

// Where the nearest timed line after `index` starts, background included.
function nextLineStart(lines: readonly LyricLine[], index: number): number {
  for (let next = index + 1; next < lines.length; next++) {
    const bounds = effectiveBounds(lines[next]);
    if (bounds) return bounds.begin;
  }
  return Number.POSITIVE_INFINITY;
}

// Where the nearest timed line before `index` ends, background included.
function previousLineEnd(lines: readonly LyricLine[], index: number): number {
  for (let previous = index - 1; previous >= 0; previous--) {
    const bounds = effectiveBounds(lines[previous]);
    if (bounds) return bounds.end;
  }
  return 0;
}

// -- Exports ------------------------------------------------------------------

export { nextLineStart, previousLineEnd };
