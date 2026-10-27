import { withAlignedWords } from "@/domain/language/align";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LyricLine } from "@/domain/line/model";
import { type WordTrack, trackField } from "@/domain/line/tracks";
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

async function mergeSelectedWords(lineId: string, type: WordTrack, indices: number[]): Promise<void> {
  const line = useProjectStore.getState().lines.find((l) => l.id === lineId);
  if (!line) return;
  const field = trackField(type);
  const words = withAlignedWords(line)[field];
  if (!words) return;
  const merged = mergeWordRun(words, indices);
  if (!merged) return;
  useTimelineStore.getState().clearSelection();
  await handleWordChangeWithDivergenceCheck(
    lineId,
    merged,
    field,
    field === "backgroundWords" ? manualBackgroundWordEdit(merged) : {},
  );
}

// -- Exports -------------------------------------------------------------------

export { isPartialSyllableSelection, mergeRunKind, mergeSelectedWords };
