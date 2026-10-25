import { effectiveTrackWords, getEffectiveLines } from "@/domain/line/effective-words";
import type { WordSelection } from "@/domain/selection/model";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

type LoupeEdge = "begin" | "end";

interface LoupeTarget {
  lineId: string;
  track: "word" | "bg";
  wordIndex: number;
  edge: LoupeEdge;
  startTime: number;
  time: number;
  settledAt: number | null;
}

type LoupeEdit = Omit<LoupeTarget, "settledAt">;

type EditedWord = Pick<WordSelection, "lineId" | "wordIndex" | "type">;

// -- Constants ----------------------------------------------------------------

const LOUPE_LINGER_MS = 700;

// -- State --------------------------------------------------------------------

let clearTimer: ReturnType<typeof setTimeout> | null = null;

// -- Functions ----------------------------------------------------------------

function sameEdge(a: LoupeTarget, b: LoupeEdit): boolean {
  return a.lineId === b.lineId && a.track === b.track && a.wordIndex === b.wordIndex && a.edge === b.edge;
}

function cancelClear(): void {
  if (clearTimer === null) return;
  clearTimeout(clearTimer);
  clearTimer = null;
}

// Back to back edits of one edge keep the first start time, so the delta reads the whole edit.
function showLoupeEdit(edit: LoupeEdit, settled: boolean): void {
  const timeline = useTimelineStore.getState();
  if (!timeline.spectrumVisible) return;
  cancelClear();
  const previous = timeline.loupeTarget;
  const startTime = previous && sameEdge(previous, edit) ? previous.startTime : edit.startTime;
  timeline.setLoupeTarget({ ...edit, startTime, settledAt: settled ? performance.now() : null });
  if (settled) clearTimer = setTimeout(clearLoupe, LOUPE_LINGER_MS);
}

function settleLoupe(): void {
  const target = useTimelineStore.getState().loupeTarget;
  if (target) showLoupeEdit(target, true);
}

function clearLoupe(): void {
  cancelClear();
  useTimelineStore.getState().setLoupeTarget(null);
}

function storedEdgeTime(word: EditedWord, edge: LoupeEdge): number | null {
  const line = getEffectiveLines(useProjectStore.getState().lines).find((candidate) => candidate.id === word.lineId);
  const timing = line ? effectiveTrackWords(line, word.type)?.[word.wordIndex] : undefined;
  return timing ? timing[edge] : null;
}

// For key edits that write the store directly: the edge's new time is read back after the write.
function showLoupeAfterKeyEdit(word: EditedWord, edge: LoupeEdge, startTime: number): void {
  if (!useTimelineStore.getState().spectrumVisible) return;
  const time = storedEdgeTime(word, edge);
  if (time === null) return;
  showLoupeEdit({ lineId: word.lineId, track: word.type, wordIndex: word.wordIndex, edge, startTime, time }, true);
}

// -- Exports ------------------------------------------------------------------

export { settleLoupe, showLoupeAfterKeyEdit, showLoupeEdit, storedEdgeTime };
export type { LoupeEdge, LoupeTarget };
