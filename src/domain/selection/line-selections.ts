import { drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine } from "@/domain/line/model";
import { trackRole } from "@/domain/line/track";
import type { SyllableAddress } from "@/domain/selection/model";
import { addressOf } from "@/domain/selection/resolve";

// -- Constants ----------------------------------------------------------------

const TRACKS = ["word", "bg"] as const;

// -- Functions ----------------------------------------------------------------

function lineWordSelections(line: LyricLine): SyllableAddress[] {
  return TRACKS.flatMap((type) => drawnSyllables(line, trackRole(type)).map((word) => addressOf(line, type, word)));
}

// -- Exports ------------------------------------------------------------------

export { lineWordSelections };
