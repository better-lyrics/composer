import { drawnSyllables } from "./line-drawn-track";
import type { LyricLine } from "./line";
import { trackRole } from "./line-track";
import type { SyllableAddress } from "./selection-model";
import { addressOf } from "./selection-resolve";

// -- Constants ----------------------------------------------------------------

const TRACKS = ["word", "bg"] as const;

// -- Functions ----------------------------------------------------------------

function lineWordSelections(line: LyricLine, splitChar: string): SyllableAddress[] {
  return TRACKS.flatMap((type) =>
    drawnSyllables(line, trackRole(type), splitChar).map((word) => addressOf(line, type, word)),
  );
}

// -- Exports ------------------------------------------------------------------

export { lineWordSelections };
