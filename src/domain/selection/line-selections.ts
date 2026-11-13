import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { SyllableAddress } from "@/domain/selection/model";
import { addressOf } from "@/domain/selection/resolve";

// -- Constants ----------------------------------------------------------------

const TRACKS = ["word", "bg"] as const;

// -- Functions ----------------------------------------------------------------

function lineWordSelections(line: LyricLine): SyllableAddress[] {
  return TRACKS.flatMap((type) => (effectiveTrackWords(line, type) ?? []).map((word) => addressOf(line, type, word)));
}

// -- Exports ------------------------------------------------------------------

export { lineWordSelections };
