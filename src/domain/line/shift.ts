import { type TimeRange, UNBOUNDED_TIME_RANGE } from "@/domain/group/shared-timing";
import { bgBounds, effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";

function shiftWords(words: readonly WordTiming[], delta: number): WordTiming[] {
  return words.map((w) => ({ ...w, begin: Math.max(0, w.begin + delta), end: Math.max(0, w.end + delta) }));
}

// Lines shifted together stop at the range edges as a whole, so a shift past an edge never shortens or overlaps them.
function clampShiftDelta(lines: readonly LyricLine[], delta: number, range: TimeRange = UNBOUNDED_TIME_RANGE): number {
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    const bounds = effectiveBounds(line) ?? bgBounds(line);
    if (!bounds) continue;
    earliest = Math.min(earliest, bounds.begin);
    latest = Math.max(latest, bounds.end);
  }
  if (!Number.isFinite(earliest)) return delta;
  return Math.max(range.min - earliest, Math.min(delta, range.max - latest));
}

// Background words move with the main vocal so they keep their place relative to it.
function shiftLineTiming(line: LyricLine, delta: number, range?: TimeRange): Partial<LyricLine> {
  const clamped = clampShiftDelta([line], delta, range);
  const background = line.backgroundWords?.length ? { backgroundWords: shiftWords(line.backgroundWords, clamped) } : {};
  if (line.words?.length) return { words: shiftWords(line.words, clamped), ...background };
  if (isLineSynced(line)) return { begin: line.begin + clamped, end: line.end + clamped, ...background };
  return background;
}

export { clampShiftDelta, shiftLineTiming, shiftWords };
