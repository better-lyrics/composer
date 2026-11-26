import { drawnSyllables } from "@/domain/line/drawn-track";
import type { LyricLine } from "@/domain/line/model";
import { trackRole } from "@/domain/line/track";
import { type ResolvedAddress, resolvedAt } from "@/domain/selection/resolve";
import type { LoupeTarget } from "@/views/timeline/loupe/loupe-target";
import { findBoundaryTarget } from "@/views/timeline/word-at-playhead";

// -- Helpers ------------------------------------------------------------------

function firstSyncedWord(lines: readonly LyricLine[]): ResolvedAddress | null {
  const lineIndex = lines.findIndex((line) => drawnSyllables(line, "main").length > 0);
  return lineIndex === -1 ? null : resolvedAt(lines, lineIndex, "word", 0);
}

// -- Functions ----------------------------------------------------------------

// The start edge nearest the playhead, else the first synced word.
function previewLoupeTarget(lines: readonly LyricLine[], playhead: number): LoupeTarget | null {
  const selection = findBoundaryTarget(lines, playhead, "begin") ?? firstSyncedWord(lines);
  if (!selection) return null;
  const line = lines[selection.lineIndex];
  const word = drawnSyllables(line, trackRole(selection.type))[selection.wordIndex];
  if (!word) return null;
  return {
    lineId: selection.lineId,
    type: selection.type,
    syllableId: selection.syllableId,
    edge: "begin",
    startTime: word.begin,
    time: word.begin,
    settledAt: null,
  };
}

// -- Exports ------------------------------------------------------------------

export { previewLoupeTarget };
