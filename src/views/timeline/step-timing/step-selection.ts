import { sameWordSelection } from "@/domain/selection/identity";
import type { WordSelection } from "@/domain/selection/model";
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
  const cleared = selections.length > 0 ? { loopRegion: null } : {};
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

// -- Exports ------------------------------------------------------------------

export { isWholeLane, selectionPatch, stepTimingPatch, toggledSelectionPatch };
