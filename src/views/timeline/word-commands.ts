import { markWordsExplicit, mergeSyllableGroup } from "@/domain/commands/word-edits";
import type { LyricLine } from "@/domain/line/model";
import { type TrackField, trackField, trackWords } from "@/domain/line/tracks";
import { contiguousSelectionRun, type SelectionRun } from "@/domain/selection/contiguous";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveAddresses } from "@/domain/selection/resolve";
import { isInSyllableGroup } from "@/domain/word/syllable-groups";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useProjectStore } from "@/stores/project";
import {
  type ExplicitToggleResolution,
  resolveExplicitSelectionToggle,
} from "@/views/timeline/explicit-selection-toggle";
import { isPartialSyllableSelection, mergeRunKind, mergeSelectedWords } from "@/views/timeline/merge-selected-words";

// -- Types ---------------------------------------------------------------------

type SyllableMerge =
  | { kind: "run"; run: SelectionRun }
  | { kind: "groups"; lineId: string; field: TrackField; indices: number[] };

interface WordMerge {
  run: SelectionRun;
  kind: ReturnType<typeof mergeRunKind>;
}

// -- Targets -------------------------------------------------------------------

// Structural Timeline commands act on the selection. The context menu selects the word it was opened on
// first, and both the menu and the keyboard read these targets, so a command never acts on other words.

function singleSelectedWord(selection: SyllableAddress[]): SyllableAddress | null {
  return selection.length === 1 ? selection[0] : null;
}

function wordMergeTarget(selection: SyllableAddress[], lines: LyricLine[]): WordMerge | null {
  const run = contiguousSelectionRun(resolveAddresses(lines, selection));
  if (!run) return null;
  const line = lines.find((candidate) => candidate.id === run.lineId);
  if (!line) return null;
  return { run, kind: mergeRunKind(line, run) };
}

function syllableMergeTarget(addresses: SyllableAddress[], lines: LyricLine[]): SyllableMerge | null {
  const selection = resolveAddresses(lines, addresses);
  if (selection.length === 0) return null;
  const first = selection[0];
  if (!selection.every((word) => word.lineId === first.lineId && word.type === first.type)) return null;
  const line = lines.find((candidate) => candidate.id === first.lineId);
  if (!line) return null;
  const run = contiguousSelectionRun(selection);
  if (run && isPartialSyllableSelection(line, run)) return { kind: "run", run };
  const words = trackWords(line, first.type);
  const indices = selection.map((word) => word.wordIndex);
  if (!indices.some((index) => isInSyllableGroup(words ?? [], index))) return null;
  return { kind: "groups", lineId: first.lineId, field: trackField(first.type), indices };
}

function explicitToggleTarget(selection: SyllableAddress[], lines: LyricLine[]): ExplicitToggleResolution | null {
  if (selection.length === 0) return null;
  const resolution = resolveExplicitSelectionToggle(lines, selection);
  return resolution.targets.length > 0 ? resolution : null;
}

// -- Runs ----------------------------------------------------------------------

function runWordMerge(target: WordMerge): void {
  void mergeSelectedWords(target.run.lineId, target.run.type, target.run.indices);
}

function runSyllableMerge(target: SyllableMerge): void {
  if (target.kind === "run") {
    void mergeSelectedWords(target.run.lineId, target.run.type, target.run.indices);
    return;
  }
  useProjectStore.getState().commit(mergeSyllableGroup(target.lineId, target.field, target.indices));
}

function runExplicitToggle(target: ExplicitToggleResolution): void {
  useProjectStore.getState().commit(markWordsExplicit(target.targets, target.value));
  noteGuideSignal("timeline.explicit");
}

// -- Exports -------------------------------------------------------------------

export type { SyllableMerge, WordMerge };
export {
  explicitToggleTarget,
  runExplicitToggle,
  runSyllableMerge,
  runWordMerge,
  singleSelectedWord,
  syllableMergeTarget,
  wordMergeTarget,
};
