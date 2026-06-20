import { bgBounds, mainBounds } from "@/domain/line/bounds";
import type { Bounds } from "@/domain/word/bounds";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

// The union of all timed content across a slice: per line, the main voice and
// the background voice each contribute their own bounds. effectiveBounds is not
// used here because it is a layout envelope gated on the main voice (it returns
// null for a background-only line); instanceBounds must count that background.
function instanceBounds(lines: LyricLine[]): Bounds | null {
  let begin = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    for (const b of [mainBounds(line), bgBounds(line)]) {
      if (!b) continue;
      if (b.begin < begin) begin = b.begin;
      if (b.end > end) end = b.end;
    }
  }
  if (!Number.isFinite(begin) || !Number.isFinite(end)) return null;
  return { begin, end };
}

// -- Exports ------------------------------------------------------------------

export { instanceBounds };
