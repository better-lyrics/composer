import { effectiveTrackWords, getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import { type ResolvedAddress, resolvedAt } from "@/domain/selection/resolve";
import type { LoupeTarget } from "@/views/timeline/loupe/loupe-target";
import { findBoundaryTarget } from "@/views/timeline/word-at-playhead";

// -- Helpers ------------------------------------------------------------------

function firstSyncedWord(lines: readonly LyricLine[]): ResolvedAddress | null {
  const lineIndex = lines.findIndex(isWordSynced);
  return lineIndex === -1 ? null : resolvedAt(lines, lineIndex, "word", 0);
}

// -- Functions ----------------------------------------------------------------

// The start edge nearest the playhead, else the first synced word.
function previewLoupeTarget(lines: readonly LyricLine[], playhead: number): LoupeTarget | null {
  const effectiveLines = getEffectiveLines(lines);
  const selection = findBoundaryTarget(effectiveLines, playhead, "begin") ?? firstSyncedWord(effectiveLines);
  if (!selection) return null;
  const line = effectiveLines[selection.lineIndex];
  const word = effectiveTrackWords(line, selection.type)?.[selection.wordIndex];
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
