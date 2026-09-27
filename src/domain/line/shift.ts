import { mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import type { WordTiming } from "@/domain/word/timing";

function shiftWords(words: readonly WordTiming[], delta: number): WordTiming[] {
  return words.map((w) => ({ ...w, begin: Math.max(0, w.begin + delta), end: Math.max(0, w.end + delta) }));
}

// Lines shifted together stop at zero as a whole, so a shift past the start never shortens or overlaps them.
function clampShiftDelta(lines: readonly LyricLine[], delta: number): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const line of lines) earliest = Math.min(earliest, mainBounds(line)?.begin ?? Number.POSITIVE_INFINITY);
  return Number.isFinite(earliest) ? Math.max(delta, -earliest) : delta;
}

// Background words move with the main vocal so they keep their place relative to it.
function shiftLineTiming(line: LyricLine, delta: number): Partial<LyricLine> {
  const clamped = clampShiftDelta([line], delta);
  const background = line.backgroundWords?.length ? { backgroundWords: shiftWords(line.backgroundWords, clamped) } : {};
  if (line.words?.length) return { words: shiftWords(line.words, clamped), ...background };
  if (isLineSynced(line)) return { begin: line.begin + clamped, end: line.end + clamped, ...background };
  return background;
}

export { clampShiftDelta, shiftLineTiming, shiftWords };
