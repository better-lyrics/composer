import { withAlignedWords } from "@/domain/language/align";
import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { type TrackField, type WordTrack, trackField } from "@/domain/line/tracks";
import type { SelectionRun } from "@/domain/selection/contiguous";
import { isPartialSyllableRun, isWholeSyllableGroupRun, mergeWordRun } from "@/domain/word/merge-run";
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

// Each linked copy merges its own words at the same slots, so its own timing and syllable groups survive.
function mergeSelectedWords(lineId: string, type: WordTrack, indices: number[]): void {
  const { lines, updateLinesWithHistory } = useProjectStore.getState();
  const source = lines.find((l) => l.id === lineId);
  if (!source) return;
  const field = trackField(type);
  const sourceCount = source[field]?.length;
  const scope = getLinkScope(source);
  const updates = lines.flatMap((line) => {
    const isTarget = line.id === lineId || (isLinkedSibling(line, scope) && line[field]?.length === sourceCount);
    const update = isTarget ? mergedFieldUpdate(line, field, indices) : null;
    return update ? [update] : [];
  });
  if (!updates.some((update) => update.id === lineId)) return;
  useTimelineStore.getState().clearSelection();
  updateLinesWithHistory(updates, { propagateToSiblings: false });
}

// -- Exports -------------------------------------------------------------------

export { isPartialSyllableSelection, mergeRunKind, mergeSelectedWords };
