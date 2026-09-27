import type { Agent } from "@/domain/agent/model";
import type { LyricLine, RawLine } from "@/domain/line/model";
import { withDerivedText } from "@/domain/line/reconstruct-text";
import type { LinkGroup } from "@/domain/group/template";
import type { SnapPoint } from "@/domain/snap-point/model";
import type { HistoryEntry, ProjectState } from "@/stores/project/types";
import { getSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const MAX_HISTORY_SIZE = 100;

// -- Snapshots ----------------------------------------------------------------

type SnapshotFields = Pick<HistoryEntry, "lines" | "groups" | "agents" | "customSnapPoints">;

function snapshotEntry(fields: SnapshotFields): HistoryEntry {
  return {
    lines: structuredClone(fields.lines),
    groups: structuredClone(fields.groups),
    agents: structuredClone(fields.agents),
    customSnapPoints: structuredClone(fields.customSnapPoints),
    timestamp: Date.now(),
  };
}

function restoreEntry(entry: HistoryEntry): SnapshotFields {
  return {
    lines: structuredClone(entry.lines),
    groups: structuredClone(entry.groups),
    agents: structuredClone(entry.agents),
    customSnapPoints: structuredClone(entry.customSnapPoints),
  };
}

function capHistory(history: HistoryEntry[]): HistoryEntry[] {
  if (history.length > MAX_HISTORY_SIZE) history.shift();
  return history;
}

// -- History Helper -----------------------------------------------------------

function commitHistory(
  state: ProjectState,
  changes: { lines?: RawLine[]; groups?: LinkGroup[]; agents?: Agent[]; customSnapPoints?: SnapPoint[] },
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

function canUndoFrom(state: ProjectState): boolean {
  return state.historyIndex > 0 || (state.isDirtySinceHistory && state.historyIndex >= 0);
}

// -- Exports ------------------------------------------------------------------

export { canUndoFrom, commitHistory, commitPendingEdit, commitSnapPointEdit, MAX_HISTORY_SIZE, redoState, undoState };
