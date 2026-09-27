import { manualBackgroundWordEdit } from "@/domain/line/background";
import { type ReadableLine, effectiveMainWordEdit } from "@/domain/line/effective-words";
import type { LyricLine } from "@/domain/line/model";
import { trackWords } from "@/domain/line/tracks";
import { isWordSelected } from "@/domain/selection/identity";
import type { WordSelection } from "@/domain/selection/model";
import { type WordMove, applyWordMoveAcrossLines } from "@/domain/word/move-across-lines";
import { reorderWordTrack } from "@/domain/word/reorder-track";
import { expandSelectionToGroupmates } from "@/domain/word/syllable-groups";
import { useProjectStore } from "@/stores/project";
import { cloneWord } from "@/utils/word-timing";
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

// -- Constants -----------------------------------------------------------------

const DRAG_X_MIN_THRESHOLD = 5;
const LINE_SYNCED_REJECT_MESSAGE = "Sync this line into words first";

// -- Selection helpers --------------------------------------------------------

function resolveWordsToOperate(activeData: DragData, selectedWords: WordSelection[]): WordSelection[] {
  const isDraggedWordSelected = isWordSelected(
    selectedWords,
    activeData.lineId,
    activeData.wordIndex,
    activeData.trackType,
  );
  if (isDraggedWordSelected && selectedWords.length > 0) return selectedWords;
  return [
    {
      lineId: activeData.lineId,
      lineIndex: activeData.lineIndex,
      wordIndex: activeData.wordIndex,
      type: activeData.trackType,
    },
  ];
}

function expandSelectionsAcrossLines(lines: readonly ReadableLine[], selections: WordSelection[]): WordSelection[] {
  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);
  const seen = new Set<string>();
  const result: WordSelection[] = [];
  for (const sel of selections) {
    const line = linesById.get(sel.lineId);
    if (!line) continue;
    const words = trackWords(line, sel.type);
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

function groupSelectionsByLine(selections: WordSelection[]): Map<string, WordSelection[]> {
  const grouped = new Map<string, WordSelection[]>();
  for (const sel of selections) {
    const arr = grouped.get(sel.lineId) ?? [];
    arr.push(sel);
    grouped.set(sel.lineId, arr);
  }
  return grouped;
}

// -- Same-line reorder --------------------------------------------------------

function applySameLineReorder(
  activeData: DragData,
  wordsToMove: WordSelection[],
  lines: readonly ReadableLine[],
  timeDelta: number,
  duration: number,
  updateLineWithHistory: ReturnType<typeof useProjectStore.getState>["updateLineWithHistory"],
) {
  if (wordsToMove.length > 1) {
    const grouped = groupSelectionsByLine(wordsToMove);
    const updates: Array<{ id: string; updates: Partial<LyricLine> }> = [];
    const linesById = new Map<string, LyricLine>();
    for (const l of lines) linesById.set(l.id, l);

    for (const [lineId, selections] of grouped) {
      const line = linesById.get(lineId);
      if (!line) continue;

      const lineUpdates: Partial<LyricLine> = {};
      const wordIndices = new Set(selections.flatMap((s) => (s.type === "word" ? [s.wordIndex] : [])));
      const bgIndices = new Set(selections.flatMap((s) => (s.type === "bg" ? [s.wordIndex] : [])));

      if (wordIndices.size > 0 && line.words) {
        const edit = effectiveMainWordEdit(line, reorderWordTrack(line.words, wordIndices, timeDelta, duration));
        if (edit) Object.assign(lineUpdates, edit);
      }
      if (bgIndices.size > 0 && line.backgroundWords) {
        const reordered = reorderWordTrack(line.backgroundWords, bgIndices, timeDelta, duration);
        Object.assign(lineUpdates, manualBackgroundWordEdit(reordered));
      }

      if (Object.keys(lineUpdates).length > 0) updates.push({ id: lineId, updates: lineUpdates });
    }

    if (updates.length > 0) {
      useProjectStore.getState().updateLinesWithHistory(updates, { propagateToSiblings: false });
    }
    return;
  }

  const line = lines.find((l) => l.id === activeData.lineId);
  if (!line) return;
  const wordsArray = trackWords(line, activeData.trackType);
  if (!wordsArray) return;

  const wordIndex = activeData.wordIndex;
  if (wordIndex < 0 || wordIndex >= wordsArray.length) return;

  const normalized = reorderWordTrack(wordsArray, new Set([wordIndex]), timeDelta, duration);
  if (activeData.trackType === "word") {
    const edit = effectiveMainWordEdit(line, normalized);
    if (edit) updateLineWithHistory(activeData.lineId, edit, { propagateToSiblings: false });
  } else {
    updateLineWithHistory(activeData.lineId, manualBackgroundWordEdit(normalized), { propagateToSiblings: false });
  }
}

// -- Cross-line move ----------------------------------------------------------

interface CrossLineMoveArgs {
  activeData: DragData;
  targetLine: LyricLine;
  targetTrack: "word" | "bg";
  wordsToMove: WordSelection[];
  lines: readonly ReadableLine[];
  timeDelta: number;
  duration: number;
}

function buildCrossLineMoves({
  activeData,
  targetLine,
  targetTrack,
  wordsToMove,
  lines,
  timeDelta,
  duration,
}: CrossLineMoveArgs): WordMove[] {
  const linesById = new Map<string, LyricLine>();
  for (const l of lines) linesById.set(l.id, l);
  const moves: WordMove[] = [];

  for (const sel of wordsToMove) {
    if (sel.lineId !== activeData.lineId) continue;
    const sourceLine = linesById.get(sel.lineId);
    if (!sourceLine) continue;
    const sourceArr = trackWords(sourceLine, sel.type);
    const source = sourceArr?.[sel.wordIndex];
    if (!source) continue;

    const newBegin = Math.max(0, source.begin + timeDelta);
    const newEnd = Math.min(duration, source.end + timeDelta);
    if (newEnd <= newBegin) continue;

    moves.push({
      sourceLineId: sel.lineId,
      sourceWordIndex: sel.wordIndex,
      sourceTrack: sel.type,
      targetLineId: targetLine.id,
      targetTrack,
      word: cloneWord(source, { begin: newBegin, end: newEnd }),
    });
  }
  return moves;
}

// Drives every cross-track drag: across different lines, AND across tracks on
// the same line (main<->bg toggles). Routing both through the same primitive
// keeps user-facing behaviour consistent: neither path propagates to linked
// siblings. The cross-line case can't propagate cleanly anyway (two distinct
// sibling sets), and matching same-line to cross-line removes a silent
// divergence that previously made a same-line bg toggle mutate every linked
// instance while a cross-line drag did not.
function applyCrossLineMove(args: CrossLineMoveArgs) {
  const moves = buildCrossLineMoves(args);
  if (moves.length === 0) return;

  const result = applyWordMoveAcrossLines(args.lines, moves, args.duration);
  if (result.ok) {
    useProjectStore.getState().updateLinesWithHistory(result.updates, { propagateToSiblings: false });
    return;
  }
  if (result.reject === "cross-instance") {
    toast.error("Detach the line first to move it out of the group");
    return;
  }
  if (result.reject === "line-synced-target" || result.reject === "line-synced-source") {
    toast.error(LINE_SYNCED_REJECT_MESSAGE);
    return;
  }
}

// -- Exports -------------------------------------------------------------------

export {
  DRAG_X_MIN_THRESHOLD,
  LINE_SYNCED_REJECT_MESSAGE,
  applyCrossLineMove,
  applySameLineReorder,
  expandSelectionsAcrossLines,
  groupSelectionsByLine,
  resolveWordsToOperate,
};
export type { DragData };
