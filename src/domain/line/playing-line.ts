import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

// The line sounding at `time`; between lines the last one that ended, before the first line the first one ahead.
function playingLineIndex(lines: readonly LyricLine[], time: number): number {
  const bounds = lines.map(effectiveBounds);
  const sounding = bounds.findIndex((b) => b !== null && time >= b.begin && time < b.end);
  if (sounding !== -1) return sounding;
  const ended = bounds.findLastIndex((b) => b !== null && time >= b.end);
  if (ended !== -1) return ended;
  return bounds.findIndex((b) => b !== null && time < b.begin);
}

// -- Exports ------------------------------------------------------------------

export { playingLineIndex };
