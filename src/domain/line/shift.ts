import { type TimeRange, UNBOUNDED_TIME_RANGE } from "@/domain/group/shared-timing";
import { bgBounds, effectiveBounds } from "@/domain/line/bounds";
import type { LineTrack, LyricLine } from "@/domain/line/model";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "@/domain/line/track";
import { withTrackSpan, withTrackWords } from "@/domain/line/track-writes";
import type { WordTiming } from "@/domain/word/timing";

function shiftWords(words: readonly WordTiming[], delta: number): WordTiming[] {
  return words.map((w) => ({ ...w, begin: Math.max(0, w.begin + delta), end: Math.max(0, w.end + delta) }));
}

function shiftTrack<T extends LineTrack>(track: T, delta: number): T {
  if (isSpanTimed(track)) return withTrackSpan(track, track.begin + delta, track.end + delta);
  const timed = timedSyllables(track);
  return timed.length > 0 ? withTrackWords(track, shiftWords(timed, delta)) : track;
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
  if (delta > 0) return Math.max(0, Math.min(delta, range.max - latest));
  return Math.min(0, Math.max(delta, range.min - earliest));
}

// Background words move with the main vocal so they keep their place relative to it.
function shiftLineTiming(line: LyricLine, delta: number, range?: TimeRange): Partial<LyricLine> {
  const clamped = clampShiftDelta([line], delta, range);
  const main = shiftTrack(mainTrack(line), clamped);
  const background = backgroundTrack(line);
  const shiftedBackground = background && shiftTrack(background, clamped);
  if (main === mainTrack(line) && shiftedBackground === background) return {};
  return { tracks: shiftedBackground ? [main, shiftedBackground] : [main] };
}

export { clampShiftDelta, shiftLineTiming, shiftWords };
