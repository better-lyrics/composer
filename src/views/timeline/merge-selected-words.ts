import { mergeWords, planMerge } from "@/domain/commands/word-merge";
import { withAlignedWords } from "@/domain/language/align";
import type { LyricLine } from "@/domain/line/model";
import { trackWords, type WordTrack } from "@/domain/line/track";
import type { SelectionRun } from "@/domain/selection/contiguous";
import { addressAt, toAddress } from "@/domain/selection/resolve";
import { isPartialSyllableRun, isWholeSyllableGroupRun } from "@/domain/word/merge-run";
import { useProjectStore } from "@/stores/project";
import { askWordDivergence } from "@/ui/divergence-prompt";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types ---------------------------------------------------------------------

type MergeRunKind = "syllables" | "words";

// -- Functions -----------------------------------------------------------------

function isPartialSyllableSelection(line: LyricLine, run: SelectionRun): boolean {
  const words = trackWords(withAlignedWords(line), run.type);
  return !!words && isPartialSyllableRun(words, run.indices);
}

function mergeRunKind(line: LyricLine, run: SelectionRun): MergeRunKind {
  const words = trackWords(withAlignedWords(line), run.type);
  if (!words) return "words";
  return isPartialSyllableRun(words, run.indices) || isWholeSyllableGroupRun(words, run.indices)
    ? "syllables"
    : "words";
}

// A copy whose blocks cross the merged text cannot follow it exactly, so the user picks: widen it, or unlink this line.
async function mergeSelectedWords(lineId: string, type: WordTrack, indices: number[]): Promise<void> {
  const { lines, groups } = useProjectStore.getState();
  const addresses = indices.flatMap((index) => addressAt(lines, lineId, type, index) ?? []);
  const plan = planMerge(lines, addresses);
  if (!plan) return;
  const crossing = plan.crossingIds.length;
  const resolution =
    crossing > 0
      ? await askWordDivergence({
          affectedSiblingCount: crossing,
          groupLabel: groups.find((group) => group.id === plan.source.groupId)?.label,
          widensCopies: true,
        })
      : "apply";
  if (resolution === "cancel") return;
  useTimelineStore.getState().clearSelection();
  useProjectStore.getState().commit(mergeWords(addresses.map(toAddress), resolution, crossing));
}

// -- Exports -------------------------------------------------------------------

export { isPartialSyllableSelection, mergeRunKind, mergeSelectedWords };
