import { effectiveBounds, mainBounds } from "./line-bounds";
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

// `nextLineStart` for every index at once, read in one backward pass; the entry at `lines.length` is past the last line.
function nextLineStarts(lines: readonly LyricLine[]): number[] {
  const starts: number[] = new Array(lines.length + 1);
  starts[lines.length] = Number.POSITIVE_INFINITY;
  for (let index = lines.length - 1; index >= 0; index--) {
    const nextBounds = index + 1 < lines.length ? effectiveBounds(lines[index + 1]) : null;
    starts[index] = nextBounds ? nextBounds.begin : starts[index + 1];
  }
  return starts;
}

// Where the nearest timed line before `index` ends, background included.
function previousLineEnd(lines: readonly LyricLine[], index: number): number {
  for (let previous = index - 1; previous >= 0; previous--) {
    const bounds = effectiveBounds(lines[previous]);
    if (bounds) return bounds.end;
  }
  return 0;
}

// Where the main track of the nearest line before `index` with one ends; a background may run past it.
function previousMainEnd(lines: readonly LyricLine[], index: number): number {
  for (let previous = index - 1; previous >= 0; previous--) {
    const bounds = mainBounds(lines[previous]);
    if (bounds) return bounds.end;
  }
  return 0;
}

// -- Exports ------------------------------------------------------------------

export { nextLineStart, nextLineStarts, previousLineEnd, previousMainEnd };
