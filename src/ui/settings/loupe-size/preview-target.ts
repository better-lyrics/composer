import { drawnSyllables } from "insync/line-drawn-track";
import type { LyricLine } from "insync/line";
import { trackRole } from "insync/line-track";
import { type ResolvedAddress, resolvedAt } from "insync/selection-resolve";
import type { LoupeTarget } from "@/views/timeline/loupe/loupe-target";
import { findBoundaryTarget } from "@/views/timeline/word-at-playhead";
import { getSplitCharacter } from "@/utils/split-character";

// -- Helpers ------------------------------------------------------------------

function firstSyncedWord(lines: readonly LyricLine[]): ResolvedAddress | null {
  const lineIndex = lines.findIndex((line) => drawnSyllables(line, "main", getSplitCharacter()).length > 0);
  return lineIndex === -1 ? null : resolvedAt(lines, lineIndex, "word", 0, getSplitCharacter());
}

// -- Functions ----------------------------------------------------------------

// The start edge nearest the playhead, else the first synced word.
function previewLoupeTarget(lines: readonly LyricLine[], playhead: number): LoupeTarget | null {
  const selection = findBoundaryTarget(lines, playhead, "begin") ?? firstSyncedWord(lines);
  if (!selection) return null;
  const line = lines[selection.lineIndex];
  const word = drawnSyllables(line, trackRole(selection.type), getSplitCharacter())[selection.wordIndex];
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
