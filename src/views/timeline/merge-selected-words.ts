import { withAlignedWords } from "@/domain/language/align";
import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { type TrackField, type WordTrack, trackField } from "@/domain/line/tracks";
import type { SelectionRun } from "@/domain/selection/contiguous";
import {
  indicesCoveringSameText,
  isPartialSyllableRun,
  isWholeSyllableGroupRun,
  mergeWordRun,
} from "@/domain/word/merge-run";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types ---------------------------------------------------------------------

type MergeRunKind = "syllables" | "words";

// -- Functions -----------------------------------------------------------------

function isPartialSyllableSelection(line: LyricLine, run: SelectionRun): boolean {
  const words = withAlignedWords(line)[trackField(run.type)];
  return !!words && isPartialSyllableRun(words, run.indices);
}

function mergeRunKind(line: LyricLine, run: SelectionRun): MergeRunKind {
  const words = withAlignedWords(line)[trackField(run.type)];
  if (!words) return "words";
  return isPartialSyllableRun(words, run.indices) || isWholeSyllableGroupRun(words, run.indices)
    ? "syllables"
    : "words";
}

function mergedFieldUpdate(line: LyricLine, field: TrackField, indices: number[]): LineUpdate | null {
  const words = withAlignedWords(line)[field];
  const merged = words && mergeWordRun(words, indices);
  if (!merged) return null;
  return { id: line.id, updates: field === "backgroundWords" ? manualBackgroundWordEdit(merged) : { words: merged } };
}

function mergeSelectedWords(lineId: string, type: WordTrack, indices: number[]): void {
  const { lines, updateLinesWithHistory } = useProjectStore.getState();
  const source = lines.find((l) => l.id === lineId);
  if (!source) return;
  const field = trackField(type);
  const sourceWords = withAlignedWords(source)[field];
  const sourceUpdate = mergedFieldUpdate(source, field, indices);
  if (!sourceWords || !sourceUpdate) return;
  const scope = getLinkScope(source);
  const siblingUpdates = lines.flatMap((line) => {
    if (line.id === lineId || !isLinkedSibling(line, scope)) return [];
    const siblingWords = withAlignedWords(line)[field];
    if (!siblingWords) return [];
    const update = mergedFieldUpdate(line, field, indicesCoveringSameText(sourceWords, indices, siblingWords));
    return update ? [update] : [];
  });
  useTimelineStore.getState().clearSelection();
  updateLinesWithHistory([sourceUpdate, ...siblingUpdates], { propagateToSiblings: false });
}

// -- Exports -------------------------------------------------------------------

export { isPartialSyllableSelection, mergeRunKind, mergeSelectedWords };
