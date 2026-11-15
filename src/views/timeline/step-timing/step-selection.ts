import type { LyricLine } from "@/domain/line/model";
import type { LoopRegion } from "@/domain/selection/loop-region";
import { sameAddress } from "@/domain/selection/identity";
import type { SyllableAddress } from "@/domain/selection/model";
import { liveAddresses, resolveAddress, type ResolvedAddress, toAddress } from "@/domain/selection/resolve";
import { toggleAddress } from "@/domain/selection/set-ops";
import { queueOrder } from "@/domain/step-timing/step-queue";
import { useProjectStore } from "@/stores/project";

// -- Types --------------------------------------------------------------------

interface StepSelectionState {
  stepTiming: boolean;
  stepQueue: SyllableAddress[] | null;
  selectedWords: SyllableAddress[];
}

interface SelectionPatch {
  selectedWords: SyllableAddress[];
  stepQueue: SyllableAddress[] | null;
  loopRegion?: null;
}

// -- Functions ----------------------------------------------------------------

// Callers may pass resolved addresses; the store keeps only what names the word.
function bareAddresses(addresses: SyllableAddress[]): SyllableAddress[] {
  return addresses.every((address) => Object.keys(address).length === 3) ? addresses : addresses.map(toAddress);
}

// In Step timing a selection of several words becomes the queue and the selection collapses to the cursor.
// A lane pick or a queue edit stays a queue even at one word, so the keys never leave the chosen words.
function selectionPatch(state: StepSelectionState, picked: SyllableAddress[], asQueue = false): SelectionPatch {
  const selections = bareAddresses(picked);
  // In Step timing a loop region and the cursor live together, so you can loop a hard part while you time it.
  const cleared = selections.length > 0 && !state.stepTiming ? { loopRegion: null } : {};
  if (!state.stepTiming || selections.length === 0) return { selectedWords: selections, stepQueue: null, ...cleared };
  if (selections.length === 1 && !asQueue) {
    const inQueue = state.stepQueue?.some((queued) => sameAddress(queued, selections[0]));
    return { selectedWords: selections, stepQueue: inQueue ? state.stepQueue : null, ...cleared };
  }
  const queue = queueOrder(useProjectStore.getState().lines, selections);
  if (queue.length === 0) return { selectedWords: [], stepQueue: null, ...cleared };
  const current = state.selectedWords[0];
  const cursor = current && queue.find((queued) => sameAddress(queued, current));
  return { selectedWords: [cursor ?? queue[0]], stepQueue: queue, ...cleared };
}

// Clearing a selection that is already empty keeps the state, so no subscriber sees a change.
function selectionWrite<S extends StepSelectionState>(
  state: S,
  selections: SyllableAddress[],
  asQueue?: boolean,
): S | SelectionPatch {
  const unchanged = selections.length === 0 && state.selectedWords.length === 0 && state.stepQueue === null;
  return unchanged ? state : selectionPatch(state, selections, asQueue);
}

// Cmd-click adds to or takes from the queue, not just the cursor.
function toggledSelectionPatch(state: StepSelectionState, selection: SyllableAddress): SelectionPatch {
  const toggled = toggleAddress(state.stepQueue ?? state.selectedWords, selection);
  return selectionPatch({ ...state, stepQueue: null }, toggled, state.stepQueue !== null);
}

function stepTimingPatch(state: StepSelectionState, stepTiming: boolean): SelectionPatch & { stepTiming: boolean } {
  return { stepTiming, ...selectionPatch({ ...state, stepTiming }, state.selectedWords) };
}

function isWholeLane(selected: readonly SyllableAddress[], lane: readonly SyllableAddress[]): boolean {
  return (
    lane.length > 0 &&
    selected.length === lane.length &&
    lane.every((word) => selected.some((other) => sameAddress(other, word)))
  );
}

// The cursor and queue against the current lines, so edits elsewhere never leave them on a word that is gone.
function liveStepSelection(
  lines: readonly LyricLine[],
  selectedWords: readonly SyllableAddress[],
  stepQueue: SyllableAddress[] | null,
): { cursor: ResolvedAddress | null; queue: SyllableAddress[] | null } {
  const cursor = selectedWords[0] ? resolveAddress(lines, selectedWords[0]) : null;
  const queue = stepQueue ? liveAddresses(lines, stepQueue) : [];
  return { cursor, queue: queue.length > 0 ? queue : null };
}

function loopRegionPatch(state: StepSelectionState, loopRegion: LoopRegion | null) {
  return loopRegion && state.selectedWords.length > 0 && !state.stepTiming
    ? { loopRegion, selectedWords: [] }
    : { loopRegion };
}

// -- Exports ------------------------------------------------------------------

export {
  isWholeLane,
  liveStepSelection,
  loopRegionPatch,
  selectionPatch,
  selectionWrite,
  stepTimingPatch,
  toggledSelectionPatch,
};
