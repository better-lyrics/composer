import type { LyricLine } from "@/domain/line/model";
import { hasMainLyrics } from "@/domain/line/predicates";

// -- Predicates ---------------------------------------------------------------

function hasLyricLines(lines: readonly LyricLine[]): boolean {
  return lines.some(hasMainLyrics);
}

// -- Exports ------------------------------------------------------------------

export { hasLyricLines };
