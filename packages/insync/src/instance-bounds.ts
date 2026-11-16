import type { LyricLine } from "./line";
import { bgBounds, mainBounds } from "./line-bounds";
import type { Bounds } from "./word-bounds";

// -- Functions ----------------------------------------------------------------

function instanceBounds(lines: LyricLine[]): Bounds | null {
  let begin = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    for (const bounds of [mainBounds(line), bgBounds(line)]) {
      if (!bounds) continue;
      begin = Math.min(begin, bounds.begin);
      end = Math.max(end, bounds.end);
    }
  }
  if (!Number.isFinite(begin) || !Number.isFinite(end)) return null;
  return { begin, end };
}

// -- Exports ------------------------------------------------------------------

export { instanceBounds };
