import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";

// -- Interfaces ---------------------------------------------------------------

// Untimed lines hold NaN bounds; every running extreme below is non-decreasing, so each question is a binary search.
interface PlayingLineLookup {
  begins: Float64Array;
  ends: Float64Array;
  maxEndSoFar: Float64Array;
  maxBeginSoFar: Float64Array;
  minBeginFromHere: Float64Array;
  minEndFromHere: Float64Array;
}

// -- Lookup -------------------------------------------------------------------

const lookupByLines = new WeakMap<readonly LyricLine[], PlayingLineLookup>();

function buildLookup(lines: readonly LyricLine[]): PlayingLineLookup {
  const count = lines.length;
  const lookup: PlayingLineLookup = {
    begins: new Float64Array(count),
    ends: new Float64Array(count),
    maxEndSoFar: new Float64Array(count),
    maxBeginSoFar: new Float64Array(count),
    minBeginFromHere: new Float64Array(count),
    minEndFromHere: new Float64Array(count),
  };
  let maxEnd = Number.NEGATIVE_INFINITY;
  let maxBegin = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < count; index++) {
    const bounds = effectiveBounds(lines[index]);
    lookup.begins[index] = bounds?.begin ?? Number.NaN;
    lookup.ends[index] = bounds?.end ?? Number.NaN;
    if (bounds) {
      maxEnd = Math.max(maxEnd, bounds.end);
      maxBegin = Math.max(maxBegin, bounds.begin);
    }
    lookup.maxEndSoFar[index] = maxEnd;
    lookup.maxBeginSoFar[index] = maxBegin;
  }
  let minBegin = Number.POSITIVE_INFINITY;
  let minEnd = Number.POSITIVE_INFINITY;
  for (let index = count - 1; index >= 0; index--) {
    if (!Number.isNaN(lookup.begins[index])) {
      minBegin = Math.min(minBegin, lookup.begins[index]);
      minEnd = Math.min(minEnd, lookup.ends[index]);
    }
    lookup.minBeginFromHere[index] = minBegin;
    lookup.minEndFromHere[index] = minEnd;
  }
  return lookup;
}

function playingLineLookup(lines: readonly LyricLine[]): PlayingLineLookup {
  const cached = lookupByLines.get(lines);
  if (cached) return cached;
  const lookup = buildLookup(lines);
  lookupByLines.set(lines, lookup);
  return lookup;
}

function firstIndexAbove(nonDecreasing: Float64Array, value: number): number {
  let low = 0;
  let high = nonDecreasing.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (nonDecreasing[middle] > value) high = middle;
    else low = middle + 1;
  }
  return low;
}

// -- Functions ----------------------------------------------------------------

// The line sounding at `time`; between lines the last one that ended, before the first line the first one ahead.
function playingLineIndex(lines: readonly LyricLine[], time: number): number {
  const lookup = playingLineLookup(lines);
  const noLaterBegin = firstIndexAbove(lookup.minBeginFromHere, time);
  for (let index = firstIndexAbove(lookup.maxEndSoFar, time); index < noLaterBegin; index++) {
    if (lookup.begins[index] <= time && time < lookup.ends[index]) return index;
  }
  const lastEnded = firstIndexAbove(lookup.minEndFromHere, time) - 1;
  if (lastEnded >= 0) return lastEnded;
  const firstAhead = firstIndexAbove(lookup.maxBeginSoFar, time);
  return firstAhead < lines.length ? firstAhead : -1;
}

// -- Exports ------------------------------------------------------------------

export { playingLineIndex };
