import { mergeWords } from "@/domain/commands/word-merge";
import { withAlignedWords } from "@/domain/language/align";
import type { LyricLine } from "insync/line";
import { trackWords, type WordTrack } from "insync/line-track";
import type { SelectionRun } from "@/domain/selection/contiguous";
import { addressAt, toAddress } from "@/domain/selection/resolve";
import { isPartialSyllableRun, isWholeSyllableGroupRun } from "@/domain/word/merge-run";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types ---------------------------------------------------------------------

type MergeRunKind = "syllables" | "words";

// -- Functions -----------------------------------------------------------------

function isPartialSyllableSelection(line: LyricLine, run: SelectionRun): boolean {
  const words = trackWords(withAlignedWords(line, getSplitCharacter()), run.type);
  return !!words && isPartialSyllableRun(words, run.indices);
}

function mergeRunKind(line: LyricLine, run: SelectionRun): MergeRunKind {
  const words = trackWords(withAlignedWords(line, getSplitCharacter()), run.type);
  if (!words) return "words";
  return isPartialSyllableRun(words, run.indices) || isWholeSyllableGroupRun(words, run.indices)
    ? "syllables"
    : "words";
}

// Other instances of a group line merge the same text through its template.
function mergeSelectedWords(lineId: string, type: WordTrack, indices: number[]): void {
  const { lines } = useProjectStore.getState();
  const addresses = indices.flatMap((index) => addressAt(lines, lineId, type, index, getSplitCharacter()) ?? []);
  if (addresses.length === 0 || addresses.length !== indices.length) return;
  useTimelineStore.getState().clearSelection();
  useProjectStore.getState().commit(mergeWords(addresses.map(toAddress)));
}

// -- Exports -------------------------------------------------------------------

export { isPartialSyllableSelection, mergeRunKind, mergeSelectedWords };
