import type { LyricLine } from "@/domain/line/model";
import { isLineSynced } from "@/domain/line/predicates";
import { type TrackField, trackField, trackWords } from "@/domain/line/tracks";
import { contiguousSelectionRun, type SelectionRun } from "@/domain/selection/contiguous";
import type { WordSelection } from "@/domain/selection/model";
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

function singleSelectedWord(selection: WordSelection[]): WordSelection | null {
  return selection.length === 1 ? selection[0] : null;
}

function splittableWord(selection: WordSelection[], lines: LyricLine[]): WordSelection | null {
  const word = singleSelectedWord(selection);
  if (!word) return null;
  const line = lines.find((candidate) => candidate.id === word.lineId);
  if (!line || (word.type === "word" && isLineSynced(line))) return null;
  return word;
}

function wordMergeTarget(selection: WordSelection[], lines: LyricLine[]): WordMerge | null {
  const run = contiguousSelectionRun(selection);
  if (!run) return null;
  const line = lines.find((candidate) => candidate.id === run.lineId);
  if (!line) return null;
  return { run, kind: mergeRunKind(line, run) };
}

function syllableMergeTarget(selection: WordSelection[], lines: LyricLine[]): SyllableMerge | null {
  if (selection.length === 0) return null;
  const first = selection[0];
  if (!selection.every((word) => word.lineId === first.lineId && word.type === first.type)) return null;
  const line = lines.find((candidate) => candidate.id === first.lineId);
  if (!line) return null;
  const run = contiguousSelectionRun(selection);
  if (run && isPartialSyllableSelection(line, run)) return { kind: "run", run };
  const words = trackWords(line, first.type);
  const indices = selection.map((word) => word.wordIndex);
  if (!indices.some((index) => words?.[index]?.syllableGroupId !== undefined)) return null;
  return { kind: "groups", lineId: first.lineId, field: trackField(first.type), indices };
}

function explicitToggleTarget(selection: WordSelection[], lines: LyricLine[]): ExplicitToggleResolution | null {
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
  useProjectStore.getState().mergeSyllableGroupIntoWord(target.lineId, target.field, target.indices);
}

function runExplicitToggle(target: ExplicitToggleResolution): void {
  useProjectStore.getState().markWordsExplicit(target.targets, target.value);
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
  splittableWord,
  syllableMergeTarget,
  wordMergeTarget,
};
