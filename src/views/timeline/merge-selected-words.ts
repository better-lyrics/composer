import { withAlignedWords } from "@/domain/language/align";
import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { type TrackField, type WordTrack, trackField } from "@/domain/line/tracks";
import type { SelectionRun } from "@/domain/selection/contiguous";
import { isPartialSyllableRun, isWholeSyllableGroupRun, mergeWordRun } from "@/domain/word/merge-run";
import { useProjectStore } from "@/stores/project";
import { handleWordChangeWithDivergenceCheck } from "@/utils/word-divergence-flow";
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

// Copies with the same slots merge their own words, keeping their timing and syllable groups; any other shape goes through the divergence prompt.
async function mergeSelectedWords(lineId: string, type: WordTrack, indices: number[]): Promise<void> {
  const { lines, updateLinesWithHistory } = useProjectStore.getState();
  const source = lines.find((l) => l.id === lineId);
  if (!source) return;
  const field = trackField(type);
  const sourceUpdate = mergedFieldUpdate(source, field, indices);
  if (!sourceUpdate) return;
  const scope = getLinkScope(source);
  const siblings = lines.filter((line) => line.id !== lineId && isLinkedSibling(line, scope) && line[field]);
  useTimelineStore.getState().clearSelection();

  if (siblings.some((line) => line[field]?.length !== source[field]?.length)) {
    const merged = sourceUpdate.updates[field] ?? [];
    await handleWordChangeWithDivergenceCheck(
      lineId,
      merged,
      field,
      field === "backgroundWords" ? sourceUpdate.updates : {},
    );
    return;
  }

  const siblingUpdates = siblings.flatMap((line) => {
    const update = mergedFieldUpdate(line, field, indices);
    return update ? [update] : [];
  });
  updateLinesWithHistory([sourceUpdate, ...siblingUpdates], { propagateToSiblings: false });
}

// -- Exports -------------------------------------------------------------------

export { isPartialSyllableSelection, mergeRunKind, mergeSelectedWords };
