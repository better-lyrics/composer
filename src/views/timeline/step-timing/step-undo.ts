import type { SyllableAddress } from "@/domain/selection/model";
import { useProjectStore } from "@/stores/project";
import type { HistoryEntry } from "@/stores/project/types";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

interface StepSpot {
  selectedWords: SyllableAddress[];
  stepQueue: SyllableAddress[] | null;
}

// -- State --------------------------------------------------------------------

// Keyed by the history entry a press wrote, so the cursor follows undo and redo of exactly that press.
const pressSpots = new WeakMap<HistoryEntry, { before: StepSpot; after: StepSpot }>();

// -- Functions ----------------------------------------------------------------

function rememberStepPress(before: StepSpot): void {
  const { history, historyIndex } = useProjectStore.getState();
  const entry = history[historyIndex];
  if (!entry) return;
  const { selectedWords, stepQueue } = useTimelineStore.getState();
  pressSpots.set(entry, { before, after: { selectedWords, stepQueue } });
}

// A step amended in place (a language refresh joining the press) is a new entry with the same press behind it.
function keepSpotsOfAmendedEntry(history: readonly HistoryEntry[], previous: readonly HistoryEntry[], index: number) {
  const entry = history[index];
  const was = previous[index];
  const amended = entry !== was && history.length === previous.length && history[index - 1] === previous[index - 1];
  const spots = was ? pressSpots.get(was) : undefined;
  if (entry && amended && spots) pressSpots.set(entry, spots);
}

function followStepUndo(): () => void {
  return useProjectStore.subscribe((state, previous) => {
    if (state.historyIndex === previous.historyIndex) {
      keepSpotsOfAmendedEntry(state.history, previous.history, state.historyIndex);
      return;
    }
    if (!useTimelineStore.getState().stepTiming) return;
    const undone = state.historyIndex === previous.historyIndex - 1;
    const redone = state.historyIndex === previous.historyIndex + 1;
    const entry = undone ? previous.history[previous.historyIndex] : redone ? state.history[state.historyIndex] : null;
    const spots = entry ? pressSpots.get(entry) : undefined;
    if (spots) useTimelineStore.setState(undone ? spots.before : spots.after);
  });
}

// -- Exports ------------------------------------------------------------------

export { followStepUndo, rememberStepPress };
