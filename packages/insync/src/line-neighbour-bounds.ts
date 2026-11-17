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

// `nextLineStart` for any index; each line is read at most once, so one changed row costs a step and all rows one pass.
function nextLineStartReader(lines: readonly LyricLine[]): (index: number) => number {
  const known = new Map<number, number>();
  return (index) => {
    const walked: number[] = [];
    let start = Number.POSITIVE_INFINITY;
    for (let at = index; at < lines.length; at++) {
      const read = known.get(at);
      if (read !== undefined) {
        start = read;
        break;
      }
      walked.push(at);
      const bounds = at + 1 < lines.length ? effectiveBounds(lines[at + 1]) : null;
      if (bounds) {
        start = bounds.begin;
        break;
      }
    }
    for (const at of walked) known.set(at, start);
    return start;
  };
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

export { nextLineStart, nextLineStartReader, previousLineEnd, previousMainEnd };
