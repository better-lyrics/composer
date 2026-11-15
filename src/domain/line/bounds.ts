import type { LineTrack, LyricLine } from "@/domain/line/model";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "@/domain/line/track";
import { type Bounds, firstBegin, lastEnd } from "@/domain/word/bounds";

// -- Functions ----------------------------------------------------------------

function trackBounds(track: LineTrack | undefined): Bounds | null {
  if (!track) return null;
  if (isSpanTimed(track)) return { begin: track.begin, end: track.end };
  const timed = timedSyllables(track);
  return timed.length > 0 ? { begin: firstBegin(timed), end: lastEnd(timed) } : null;
}

function mainBounds(line: LyricLine): Bounds | null {
  return trackBounds(mainTrack(line));
}

function bgBounds(line: LyricLine): Bounds | null {
  return trackBounds(backgroundTrack(line));
}

function effectiveBounds(line: LyricLine): Bounds | null {
  const main = mainBounds(line);
  if (!main) return null;
  const bg = bgBounds(line);
  if (!bg) return main;
  return { begin: Math.min(main.begin, bg.begin), end: Math.max(main.end, bg.end) };
}

// -- Exports ------------------------------------------------------------------

export { bgBounds, effectiveBounds, mainBounds };
