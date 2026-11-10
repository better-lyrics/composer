import type { LyricLine } from "@/domain/line/model";
import { sameWordSelection } from "@/domain/selection/identity";
import type { WordSelection } from "@/domain/selection/model";
import { resolveSelections } from "@/domain/selection/resolve";
import { toggleWordSelection } from "@/domain/selection/set-ops";
import { queueOrder } from "@/domain/step-timing/step-queue";

// -- Types --------------------------------------------------------------------

interface StepSelectionState {
  stepTiming: boolean;
  stepQueue: WordSelection[] | null;
  selectedWords: WordSelection[];
}

interface SelectionPatch {
  selectedWords: WordSelection[];
  stepQueue: WordSelection[] | null;
  loopRegion?: null;
}

// -- Functions ----------------------------------------------------------------

// In Step timing a selection of several words becomes the queue and the selection collapses to the cursor.
function selectionPatch(state: StepSelectionState, selections: WordSelection[]): SelectionPatch {
  // In Step timing a loop region and the cursor live together, so you can loop a hard part while you time it.
  const cleared = selections.length > 0 && !state.stepTiming ? { loopRegion: null } : {};
  if (!state.stepTiming || selections.length === 0) return { selectedWords: selections, stepQueue: null, ...cleared };
  if (selections.length === 1) {
    const inQueue = state.stepQueue?.some((queued) => sameWordSelection(queued, selections[0]));
    return { selectedWords: selections, stepQueue: inQueue ? state.stepQueue : null, ...cleared };
  }
  const queue = queueOrder(selections);
  const current = state.selectedWords[0];
  const cursor = current && queue.find((queued) => sameWordSelection(queued, current));
  return { selectedWords: [cursor ?? queue[0]], stepQueue: queue, ...cleared };
}

// Cmd-click adds to or takes from the queue, not just the cursor.
function toggledSelectionPatch(state: StepSelectionState, selection: WordSelection): SelectionPatch {
  const toggled = toggleWordSelection(state.stepQueue ?? state.selectedWords, selection);
  return selectionPatch({ ...state, stepQueue: null }, toggled);
}

function stepTimingPatch(state: StepSelectionState, stepTiming: boolean): SelectionPatch & { stepTiming: boolean } {
  return { stepTiming, ...selectionPatch({ ...state, stepTiming }, state.selectedWords) };
}

function isWholeLane(selected: readonly WordSelection[], lane: readonly WordSelection[]): boolean {
  return (
    lane.length > 0 &&
    selected.length === lane.length &&
    lane.every((word) => selected.some((other) => sameWordSelection(other, word)))
  );
}

// The cursor and queue against the current lines, so edits elsewhere never leave them on a word that is gone.
function liveStepSelection(
  lines: readonly LyricLine[],
  selectedWords: readonly WordSelection[],
  stepQueue: readonly WordSelection[] | null,
): { cursor: WordSelection | null; queue: WordSelection[] | null } {
  const [cursor = null] = resolveSelections(lines, selectedWords.slice(0, 1));
  const queue = stepQueue ? resolveSelections(lines, stepQueue) : [];
  return { cursor, queue: queue.length > 0 ? queue : null };
}

// -- Exports ------------------------------------------------------------------

export { isWholeLane, liveStepSelection, selectionPatch, stepTimingPatch, toggledSelectionPatch };
