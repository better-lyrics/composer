import type { LyricLine } from "insync/line";
import { hasMainLyrics } from "@/domain/line/predicates";
import { getSplitCharacter } from "@/utils/split-character";

// -- Predicates ---------------------------------------------------------------

function hasLyricLines(lines: readonly LyricLine[]): boolean {
  return lines.some((value) => hasMainLyrics(value, getSplitCharacter()));
}

// -- Exports ------------------------------------------------------------------

export { hasLyricLines };
