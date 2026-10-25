import type { Agent } from "@/domain/agent/model";
import { sharedTimingFanOut } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine, RawLine } from "@/domain/line/model";
import { withDerivedText } from "@/domain/line/reconstruct-text";
import type { SnapPoint } from "@/domain/snap-point/model";
import type { BeatGrid } from "@/domain/tempo/beat-grid";
import { notifySharedTimingCopied } from "@/lib/shared-timing-signals";
import type { HistoryEntry, ProjectState } from "@/stores/project/types";
import { getSplitCharacter } from "@/utils/split-character";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Constants ----------------------------------------------------------------

const MAX_HISTORY_SIZE = 100;

// -- Snapshots ----------------------------------------------------------------

type SnapshotFields = Pick<HistoryEntry, "lines" | "groups" | "agents" | "customSnapPoints" | "beatGrid">;

function snapshotEntry(fields: SnapshotFields): HistoryEntry {
  return {
    lines: structuredClone(fields.lines),
    groups: structuredClone(fields.groups),
    agents: structuredClone(fields.agents),
    customSnapPoints: structuredClone(fields.customSnapPoints),
    beatGrid: structuredClone(fields.beatGrid),
    timestamp: Date.now(),
  };
}

function restoreEntry(entry: HistoryEntry): SnapshotFields {
  return {
    lines: structuredClone(entry.lines),
    groups: structuredClone(entry.groups),
    agents: structuredClone(entry.agents),
    customSnapPoints: structuredClone(entry.customSnapPoints),
    beatGrid: structuredClone(entry.beatGrid),
  };
}

function capHistory(history: HistoryEntry[]): HistoryEntry[] {
  if (history.length > MAX_HISTORY_SIZE) history.shift();
  return history;
}

// -- History Helper -----------------------------------------------------------

function commitHistory(
  state: ProjectState,
  changes: {
    lines?: RawLine[];
    groups?: LinkGroup[];
    agents?: Agent[];
    customSnapPoints?: SnapPoint[];
    beatGrid?: BeatGrid | null;
  },
  options: { deriveText?: boolean } = {},
) {
  const splitChar = getSplitCharacter();
  const deriveText = options.deriveText ?? true;
  const nextLines = changes.lines
    ? deriveText
      ? changes.lines.map((line) => withDerivedText(line, splitChar))
      : changes.lines
    : state.lines;
  const next: SnapshotFields = {
    lines: nextLines,
    groups: changes.groups ?? state.groups,
    agents: changes.agents ?? state.agents,
    customSnapPoints: changes.customSnapPoints ?? state.customSnapPoints,
    beatGrid: changes.beatGrid === undefined ? state.beatGrid : changes.beatGrid,
  };

  const newHistory = state.history.slice(0, state.historyIndex + 1);
  if (newHistory.length === 0 || state.isDirtySinceHistory) newHistory.push(snapshotEntry(state));
  newHistory.push(snapshotEntry(next));
  capHistory(newHistory);
  return {
    ...next,
    isDirty: true,
    isDirtySinceHistory: false,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

function sameGridApartFromOffset(a: BeatGrid | null, b: BeatGrid | null): boolean {
  return a !== null && b !== null && isStructurallyEqual({ ...a, offsetMs: 0 }, { ...b, offsetMs: 0 });
}

const offsetNudgeSteps = new WeakSet<HistoryEntry>();

// Nudges in a row join one step, so a single undo returns to the offset before nudging.
function commitBeatGridOffset(state: ProjectState, grid: BeatGrid) {
  const index = state.historyIndex;
  const current = state.history[index];
  const previous = state.history[index - 1];
  const joinsStep =
    !state.isDirtySinceHistory &&
    index === state.history.length - 1 &&
    current !== undefined &&
    previous !== undefined &&
    offsetNudgeSteps.has(current) &&
    sameGridApartFromOffset(state.beatGrid, grid);
  if (!joinsStep) {
    const committed = commitHistory(state, { beatGrid: grid });
    offsetNudgeSteps.add(committed.history[committed.historyIndex]);
    return committed;
  }
  if (isStructurallyEqual(previous.beatGrid, grid)) {
    return { beatGrid: grid, isDirty: true, history: state.history.slice(0, index), historyIndex: index - 1 };
  }
  const joined = snapshotEntry({ ...state, beatGrid: grid });
  offsetNudgeSteps.add(joined);
  return { beatGrid: grid, isDirty: true, history: state.history.with(index, joined) };
}

function changedLineIds(before: readonly RawLine[], after: readonly RawLine[]): string[] {
  const beforeById = new Map(before.map((line) => [line.id, line]));
  return after.filter((line) => beforeById.get(line.id) !== line).map((line) => line.id);
}

// `finish` runs on the lines after the copy and can refuse the whole write by returning null.
function commitSharedTimingHistory(
  state: ProjectState,
  lines: RawLine[],
  changedIds: readonly string[] = changedLineIds(state.lines, lines),
  options: { deriveText?: boolean; finish?: (copied: RawLine[]) => RawLine[] | null } = {},
) {
  const shared = sharedTimingFanOut(state.lines, lines, state.groups, changedIds);
  if (shared.rejected) return state;
  const finished = options.finish ? options.finish(shared.lines) : shared.lines;
  if (!finished) return state;
  if (shared.touchedGroupIds.length) notifySharedTimingCopied(shared.touchedGroupIds);
  return commitHistory(state, { lines: finished }, { deriveText: options.deriveText });
}

function commitPendingEdit(state: ProjectState, baseline: LyricLine[], baselineWasDirty = false) {
  if (!state.isDirtySinceHistory) return {};
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  // Seed the pre-run baseline when a non-history mutation dirtied the store
  // before the run, otherwise undo would skip straight past it.
  if (newHistory.length === 0 || baselineWasDirty) newHistory.push(snapshotEntry({ ...state, lines: baseline }));
  newHistory.push(snapshotEntry(state));
  capHistory(newHistory);
  return {
    isDirty: true,
    isDirtySinceHistory: false,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

function snapPointsEqual(a: SnapPoint[], b: SnapPoint[]): boolean {
  return a.length === b.length && a.every((point, index) => point.id === b[index].id && point.time === b[index].time);
}

function commitSnapPointEdit(state: ProjectState, baseline: SnapPoint[]) {
  if (snapPointsEqual(baseline, state.customSnapPoints)) return {};
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  const top = newHistory[newHistory.length - 1];
  if (newHistory.length === 0 || !top || !snapPointsEqual(baseline, top.customSnapPoints)) {
    newHistory.push(snapshotEntry({ ...state, customSnapPoints: baseline }));
  }
  newHistory.push(snapshotEntry(state));
  capHistory(newHistory);
  return { isDirty: true, isDirtySinceHistory: false, history: newHistory, historyIndex: newHistory.length - 1 };
}

// A pending edit becomes its own entry first so redo can return to it.
function undoState(state: ProjectState) {
  const pending = state.isDirtySinceHistory && state.historyIndex >= 0;
  if (!pending && state.historyIndex <= 0) return state;
  const history = pending
    ? capHistory([...state.history.slice(0, state.historyIndex + 1), snapshotEntry(state)])
    : state.history;
  const targetIndex = pending ? history.length - 2 : state.historyIndex - 1;
  return {
    ...restoreEntry(history[targetIndex]),
    history,
    historyIndex: targetIndex,
    isDirty: true,
    isDirtySinceHistory: false,
  };
}

function redoState(state: ProjectState) {
  if (state.historyIndex >= state.history.length - 1) return state;
  const targetIndex = state.historyIndex + 1;
  return {
    ...restoreEntry(state.history[targetIndex]),
    historyIndex: targetIndex,
    isDirty: true,
    isDirtySinceHistory: false,
  };
}

// Data that follows the lyrics joins the step that changed them, so undo never stops between the two.
function amendCurrentStep(state: ProjectState, lines: RawLine[]) {
  if (state.isDirtySinceHistory || state.historyIndex < 0) return { lines, isDirty: true, isDirtySinceHistory: true };
  return {
    lines,
    isDirty: true,
    history: state.history.with(state.historyIndex, snapshotEntry({ ...state, lines })),
  };
}

function canUndoFrom(state: ProjectState): boolean {
  return state.historyIndex > 0 || (state.isDirtySinceHistory && state.historyIndex >= 0);
}

// -- Exports ------------------------------------------------------------------

export {
  amendCurrentStep,
  canUndoFrom,
  commitBeatGridOffset,
  commitHistory,
  commitPendingEdit,
  commitSharedTimingHistory,
  commitSnapPointEdit,
  MAX_HISTORY_SIZE,
  redoState,
  undoState,
};
