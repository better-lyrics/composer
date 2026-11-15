import { effectiveBounds } from "./line-bounds";
import type { LyricLine } from "./line";
import { memoByIdentity } from "./memo-by-identity";

// -- Functions ----------------------------------------------------------------

const lineStart = memoByIdentity((line: LyricLine) => effectiveBounds(line)?.begin ?? Number.NaN);

function lineStarts(lines: readonly LyricLine[]): number[] {
  return lines.map(lineStart);
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
