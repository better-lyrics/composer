import type { LyricLine } from "@/domain/line/model";
import type { SyncGranularity } from "@/domain/line/sync-progress";

// -- Types --------------------------------------------------------------------

type LaneClickTarget = { kind: "word"; wordIndex: number } | { kind: "line" } | null;

// -- Functions ----------------------------------------------------------------

// Only a word that already has timing can be re-recorded; see handleJumpToWord.
function laneClickTarget(line: LyricLine, wordIndex: number, granularity: SyncGranularity): LaneClickTarget {
  if (granularity === "line") return { kind: "line" };
  if (line.words?.[wordIndex]) return { kind: "word", wordIndex };
  return wordIndex === 0 ? { kind: "line" } : null;
}

// -- Exports ------------------------------------------------------------------

export { laneClickTarget };
export type { LaneClickTarget };
