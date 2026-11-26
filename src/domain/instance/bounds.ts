import { bgBounds, mainBounds } from "@/domain/line/bounds";
import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import type { Bounds } from "@/domain/word/bounds";

// -- Functions ----------------------------------------------------------------

// A line's main span counts only when it has no timed background words, as the timed words decide otherwise.
function instanceBounds(lines: LyricLine[]): Bounds | null {
  let begin = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    const background = bgBounds(line);
    const main = isWordSynced(line) || !background ? mainBounds(line) : null;
    for (const bounds of [main, background]) {
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
