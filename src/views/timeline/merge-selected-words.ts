import { withAlignedWords } from "@/domain/language/align";
import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { type TrackField, type WordTrack, trackField } from "@/domain/line/tracks";
import type { SelectionRun } from "@/domain/selection/contiguous";
import { copyMergeCover, isPartialSyllableRun, isWholeSyllableGroupRun, mergeWordRun } from "@/domain/word/merge-run";
import type { WordTiming } from "@/domain/word/timing";
import { useProjectStore } from "@/stores/project";
import { askWordDivergence } from "@/ui/divergence-prompt";
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

function linkedCopyCovers(source: LyricLine, sourceWords: WordTiming[], field: TrackField, indices: number[]) {
  const scope = getLinkScope(source);
  return useProjectStore.getState().lines.flatMap((line) => {
    if (line.id === source.id || !isLinkedSibling(line, scope)) return [];
    const words = withAlignedWords(line)[field];
    return words ? [{ line, cover: copyMergeCover(sourceWords, indices, words) }] : [];
  });
}

// A copy whose blocks cross the merged text cannot follow it exactly, so the user picks: widen it, or unlink this line.
async function mergeSelectedWords(lineId: string, type: WordTrack, indices: number[]): Promise<void> {
  const { lines, groups } = useProjectStore.getState();
  const source = lines.find((l) => l.id === lineId);
  if (!source) return;
  const field = trackField(type);
  const sourceWords = withAlignedWords(source)[field];
  const sourceUpdate = mergedFieldUpdate(source, field, indices);
  if (!sourceWords || !sourceUpdate) return;
  const copies = linkedCopyCovers(source, sourceWords, field, indices);
  const crossing = copies.filter(({ cover }) => cover.inside.length !== cover.overlapping.length).length;
  const resolution =
    crossing > 0
      ? await askWordDivergence({
          affectedSiblingCount: crossing,
          groupLabel: groups.find((group) => group.id === source.groupId)?.label,
          widensCopies: true,
        })
      : "apply";
  if (resolution === "cancel") return;
  useTimelineStore.getState().clearSelection();
  const store = useProjectStore.getState();
  if (resolution === "detach") {
    const merged = sourceUpdate.updates[field] ?? [];
    store.applyWordCountChange(
      lineId,
      merged,
      field,
      "detach",
      field === "backgroundWords" ? sourceUpdate.updates : {},
    );
    return;
  }
  const copyUpdates = copies.flatMap(({ line, cover }) => {
    const update = mergedFieldUpdate(line, field, cover.overlapping);
    return update ? [update] : [];
  });
  store.updateLinesWithHistory([sourceUpdate, ...copyUpdates], { propagateToSiblings: false });
}

// -- Exports -------------------------------------------------------------------

export { isPartialSyllableSelection, mergeRunKind, mergeSelectedWords };
