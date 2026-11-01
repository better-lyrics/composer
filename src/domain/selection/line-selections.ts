import { effectiveTrackWords } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";

// -- Constants ----------------------------------------------------------------

const TRACKS = ["word", "bg"] as const;

// -- Functions ----------------------------------------------------------------

function lineWordSelections(line: LyricLine, lineIndex: number): WordSelection[] {
  return TRACKS.flatMap((type) =>
    (effectiveTrackWords(line, type) ?? []).map((_, wordIndex) => ({ lineId: line.id, lineIndex, wordIndex, type })),
  );
}

// -- Exports ------------------------------------------------------------------

export { lineWordSelections };
