import type { LyricLine } from "@/domain/line/model";
import { withDerivedText } from "@/domain/line/reconstruct-text";
import type { LinkGroup } from "@/domain/group/template";
import type { SnapPoint } from "@/domain/snap-point/model";
import type { ProjectState } from "@/stores/project/types";
import { getSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const MAX_HISTORY_SIZE = 100;

// -- History Helper -----------------------------------------------------------

function commitHistory(
  state: ProjectState,
  changes: { lines?: LyricLine[]; groups?: LinkGroup[]; customSnapPoints?: SnapPoint[] },
  options: { deriveText?: boolean } = {},
) {
  const splitChar = getSplitCharacter();
  const deriveText = options.deriveText ?? true;
  const nextLines = changes.lines
    ? deriveText
      ? changes.lines.map((line) => withDerivedText(line, splitChar))
      : changes.lines
    : state.lines;
  const nextGroups = changes.groups ?? state.groups;
  const nextCustomSnapPoints = changes.customSnapPoints ?? state.customSnapPoints;

  const newHistory = state.history.slice(0, state.historyIndex + 1);
  if (newHistory.length === 0 || state.isDirtySinceHistory) {
    newHistory.push({
      lines: structuredClone(state.lines),
      groups: structuredClone(state.groups),
      customSnapPoints: structuredClone(state.customSnapPoints),
      timestamp: Date.now(),
    });
  }
  newHistory.push({
    lines: structuredClone(nextLines),
    groups: structuredClone(nextGroups),
    customSnapPoints: structuredClone(nextCustomSnapPoints),
    timestamp: Date.now(),
  });
  if (newHistory.length > MAX_HISTORY_SIZE) newHistory.shift();
  return {
    lines: nextLines,
    groups: nextGroups,
    customSnapPoints: nextCustomSnapPoints,
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
  if (newHistory.length === 0 || baselineWasDirty) {
    newHistory.push({
      lines: structuredClone(baseline),
      groups: structuredClone(state.groups),
      customSnapPoints: structuredClone(state.customSnapPoints),
      timestamp: Date.now(),
    });
  }
  newHistory.push({
    lines: structuredClone(state.lines),
    groups: structuredClone(state.groups),
    customSnapPoints: structuredClone(state.customSnapPoints),
    timestamp: Date.now(),
  });
  if (newHistory.length > MAX_HISTORY_SIZE) newHistory.shift();
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
    newHistory.push({
      lines: structuredClone(state.lines),
      groups: structuredClone(state.groups),
      customSnapPoints: structuredClone(baseline),
      timestamp: Date.now(),
    });
  }
  newHistory.push({
    lines: structuredClone(state.lines),
    groups: structuredClone(state.groups),
    customSnapPoints: structuredClone(state.customSnapPoints),
    timestamp: Date.now(),
  });
  if (newHistory.length > MAX_HISTORY_SIZE) newHistory.shift();
  return { isDirty: true, isDirtySinceHistory: false, history: newHistory, historyIndex: newHistory.length - 1 };
}

// -- Exports ------------------------------------------------------------------

export { commitHistory, commitPendingEdit, commitSnapPointEdit, MAX_HISTORY_SIZE };
