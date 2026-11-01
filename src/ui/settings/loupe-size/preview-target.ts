import { effectiveTrackWords, getEffectiveLines } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { isWordSynced } from "@/domain/line/predicates";
import type { WordSelection } from "@/domain/selection/model";
import type { LoupeTarget } from "@/views/timeline/loupe/loupe-target";
import { findBoundaryTarget } from "@/views/timeline/word-at-playhead";

// -- Helpers ------------------------------------------------------------------

function firstSyncedWord(lines: readonly LyricLine[]): WordSelection | null {
  const lineIndex = lines.findIndex(isWordSynced);
  if (lineIndex === -1) return null;
  return { lineId: lines[lineIndex].id, lineIndex, wordIndex: 0, type: "word" };
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
    track: selection.type,
    wordIndex: selection.wordIndex,
    edge: "begin",
    startTime: word.begin,
    time: word.begin,
    settledAt: null,
  };
}

// -- Exports ------------------------------------------------------------------

export { previewLoupeTarget };
