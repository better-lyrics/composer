import { effectiveBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

function lineStarts(lines: readonly LyricLine[]): number[] {
  return lines.map((line) => effectiveBounds(line)?.begin ?? Number.NaN);
}

// The last line that has started by `time`, or the first line before any has started.
function startedLineIndex(starts: readonly number[], time: number): number {
  let index = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= time) index = i;
  }
  return index;
}

// -- Exports ------------------------------------------------------------------

export { lineStarts, startedLineIndex };
