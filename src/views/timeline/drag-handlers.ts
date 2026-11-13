import { isRefused } from "@/domain/commands/outcome";
import { moveWords, moveWordsAcrossLines } from "@/domain/commands/word-moves";
import type { LyricLine } from "@/domain/line/model";
import { drawnSyllables } from "@/domain/line/drawn-track";
import { trackRole } from "@/domain/line/track";
import { sameAddress } from "@/domain/selection/identity";
import type { SyllableAddress } from "@/domain/selection/model";
import { addressAt, type ResolvedAddress, resolveAddresses, toAddress } from "@/domain/selection/resolve";
import type { MoveRejectReason } from "@/domain/word/move-across-lines";
import { expandSelectionToGroupmates } from "@/domain/word/syllable-groups";
import { useProjectStore } from "@/stores/project";
import { toast } from "sonner";

// -- Types ---------------------------------------------------------------------

interface DragData {
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  trackType: "word" | "bg";
  text: string;
  begin: number;
  end: number;
  initialShiftKey?: boolean;
}

// A word by its place in the lines a drag started from; valid only for that one gesture.
type DragWord = Pick<ResolvedAddress, "lineId" | "lineIndex" | "wordIndex" | "type">;

// -- Constants -----------------------------------------------------------------

const DRAG_X_MIN_THRESHOLD = 5;
const LINE_SYNCED_REJECT_MESSAGE = "Sync this line into words first";
const OVERLAP_REJECT_MESSAGE = "That spot is taken. Drop into a gap";

// -- Selection helpers --------------------------------------------------------

function draggedWord(activeData: DragData): DragWord {
  return {
    lineId: activeData.lineId,
    lineIndex: activeData.lineIndex,
    wordIndex: activeData.wordIndex,
    type: activeData.trackType,
  };
}

function resolveWordsToOperate(
  lines: readonly LyricLine[],
  activeData: DragData,
  selectedWords: readonly SyllableAddress[],
): DragWord[] {
  const dragged = addressAt(lines, activeData.lineId, activeData.trackType, activeData.wordIndex);
  const isDraggedWordSelected = dragged !== null && selectedWords.some((selected) => sameAddress(selected, dragged));
  return isDraggedWordSelected ? resolveAddresses(lines, selectedWords) : [draggedWord(activeData)];
}

function expandSelectionsAcrossLines(lines: readonly LyricLine[], selections: DragWord[]): DragWord[] {
  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);
  const seen = new Set<string>();
  const result: DragWord[] = [];
  for (const sel of selections) {
    const line = linesById.get(sel.lineId);
    if (!line) continue;
    const words = drawnSyllables(line, trackRole(sel.type));
    if (!words) continue;
    const expanded = expandSelectionToGroupmates(words, [sel.wordIndex]);
    for (const idx of expanded) {
      const key = `${sel.lineId}:${sel.type}:${idx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ lineId: sel.lineId, lineIndex: sel.lineIndex, wordIndex: idx, type: sel.type });
    }
  }
  return result;
}

function resolvedWords(lines: readonly LyricLine[], words: readonly DragWord[]): ResolvedAddress[] {
  return words.flatMap((word) => addressAt(lines, word.lineId, word.type, word.wordIndex) ?? []);
}

function addressesOf(lines: readonly LyricLine[], words: readonly DragWord[]): SyllableAddress[] {
  return resolvedWords(lines, words).map(toAddress);
}

// -- Same-line reorder --------------------------------------------------------

function applySameLineReorder(
  wordsToMove: DragWord[],
  lines: readonly LyricLine[],
  timeDelta: number,
  duration: number,
) {
  const addresses = addressesOf(lines, wordsToMove);
  useProjectStore.getState().commit(moveWords({ addresses, timeDelta, duration }));
}

// -- Cross-line move ----------------------------------------------------------

interface CrossLineMoveArgs {
  activeData: DragData;
  targetLine: LyricLine;
  targetTrack: "word" | "bg";
  wordsToMove: DragWord[];
  lines: readonly LyricLine[];
  timeDelta: number;
  duration: number;
}

const MOVE_REJECT_MESSAGE: Record<MoveRejectReason, string> = {
  "cross-instance": "Detach the line first to move it out of the group",
  "line-synced-target": LINE_SYNCED_REJECT_MESSAGE,
  "line-synced-source": LINE_SYNCED_REJECT_MESSAGE,
  overlap: OVERLAP_REJECT_MESSAGE,
};

// Drives every cross-track drag: across different lines, AND across tracks on the same line (main<->bg toggles).
function applyCrossLineMove(args: CrossLineMoveArgs) {
  const outcome = useProjectStore.getState().commit(
    moveWordsAcrossLines({
      addresses: addressesOf(args.lines, args.wordsToMove),
      fromLineId: args.activeData.lineId,
      targetLineId: args.targetLine.id,
      targetTrack: args.targetTrack,
      timeDelta: args.timeDelta,
      duration: args.duration,
    }),
  );
  if (isRefused(outcome) && outcome.refused.reason === "move") toast.error(MOVE_REJECT_MESSAGE[outcome.refused.reject]);
}

// -- Exports -------------------------------------------------------------------

export type { DragData, DragWord };
export {
  applyCrossLineMove,
  applySameLineReorder,
  DRAG_X_MIN_THRESHOLD,
  draggedWord,
  expandSelectionsAcrossLines,
  LINE_SYNCED_REJECT_MESSAGE,
  resolvedWords,
  resolveWordsToOperate,
};
