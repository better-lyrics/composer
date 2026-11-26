import { sameAddress } from "@/domain/selection/identity";
import type { SyllableAddress } from "@/domain/selection/model";
import { wordAt } from "@/domain/selection/resolve";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

type LoupeEdge = "begin" | "end";

interface LoupeTarget extends SyllableAddress {
  edge: LoupeEdge;
  startTime: number;
  time: number;
  settledAt: number | null;
}

type LoupeEdit = Omit<LoupeTarget, "settledAt">;

// -- Constants ----------------------------------------------------------------

const LOUPE_LINGER_MS = 700;

// -- State --------------------------------------------------------------------

let clearTimer: ReturnType<typeof setTimeout> | null = null;

// -- Functions ----------------------------------------------------------------

function sameEdge(a: LoupeEdit, b: LoupeEdit): boolean {
  return a.edge === b.edge && sameAddress(a, b);
}

function cancelClear(): void {
  if (clearTimer === null) return;
  clearTimeout(clearTimer);
  clearTimer = null;
}

// Back to back edits of one edge keep the first start time, so the delta reads the whole edit.
function showLoupeEdit(edit: LoupeEdit, settled: boolean): void {
  if (!useSettingsStore.getState().showSpectrum) return clearLoupe();
  const timeline = useTimelineStore.getState();
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

function storedEdgeTime(word: SyllableAddress, edge: LoupeEdge): number | null {
  const line = useProjectStore.getState().lines.find((candidate) => candidate.id === word.lineId);
  const timing = line ? wordAt([line], word) : null;
  return timing ? timing[edge] : null;
}

// For key edits that write the store directly: the edge's new time is read back after the write.
function showLoupeAfterKeyEdit(word: SyllableAddress, edge: LoupeEdge, startTime: number): void {
  if (!useSettingsStore.getState().showSpectrum) return;
  const time = storedEdgeTime(word, edge);
  if (time === null) return;
  showLoupeEdit({ lineId: word.lineId, type: word.type, syllableId: word.syllableId, edge, startTime, time }, true);
}

// -- Exports ------------------------------------------------------------------

export type { LoupeTarget };
export { settleLoupe, showLoupeAfterKeyEdit, showLoupeEdit, storedEdgeTime };
