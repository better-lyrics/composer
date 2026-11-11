import { useCallback, useRef } from "react";
import type { WordSelection } from "@/domain/selection/model";
import { useSettingsStore } from "@/stores/settings";
import { useStepView } from "@/views/timeline/step-timing/step-next";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

type TrackType = WordSelection["type"];

interface StepTrack {
  stepTiming: boolean;
  trackAttributes: { "data-word-track": true; "data-step-chain"?: "off" };
  nextWordIndex: number;
  queuedIndices: ReadonlySet<number>;
}

interface StepChoice {
  stepTiming: boolean;
  queuedIndices: ReadonlySet<number>;
  chosenLine: boolean;
  chosenBackground: boolean;
}

interface StepChoiceSource {
  stepTiming: boolean;
  stepQueue: WordSelection[] | null;
  selectedWords: WordSelection[];
}

// -- Constants ----------------------------------------------------------------

const NO_INDICES: ReadonlySet<number> = new Set();
const STEP_OFF: StepChoice = {
  stepTiming: false,
  queuedIndices: NO_INDICES,
  chosenLine: false,
  chosenBackground: false,
};

// -- Helpers ------------------------------------------------------------------

function stepChoiceOf(state: StepChoiceSource, lineId: string, type: TrackType): StepChoice {
  if (!state.stepTiming) return STEP_OFF;
  let queued: Set<number> | null = null;
  for (const queuedWord of state.stepQueue ?? []) {
    if (queuedWord.lineId !== lineId || queuedWord.type !== type) continue;
    queued ??= new Set();
    queued.add(queuedWord.wordIndex);
  }
  const chosen = state.stepQueue ?? state.selectedWords;
  return {
    stepTiming: true,
    queuedIndices: queued ?? NO_INDICES,
    chosenLine: chosen.some((s) => s.lineId === lineId),
    chosenBackground: chosen.some((s) => s.lineId === lineId && s.type === "bg"),
  };
}

function sameStepChoice(a: StepChoice, b: StepChoice): boolean {
  if (a.stepTiming !== b.stepTiming || a.chosenLine !== b.chosenLine || a.chosenBackground !== b.chosenBackground)
    return false;
  if (a.queuedIndices.size !== b.queuedIndices.size) return false;
  for (const index of a.queuedIndices) if (!b.queuedIndices.has(index)) return false;
  return true;
}

// -- Hooks --------------------------------------------------------------------

// Keeps its previous value while this track's part of the step choice is unchanged, so a step elsewhere never re-renders it.
function useStepChoice(lineId: string, type: TrackType): StepChoice {
  const cacheRef = useRef<{ queue: WordSelection[] | null; selected: WordSelection[]; value: StepChoice } | null>(null);
  const select = useCallback(
    (state: StepChoiceSource): StepChoice => {
      if (!state.stepTiming) return STEP_OFF;
      const cached = cacheRef.current;
      if (cached && cached.queue === state.stepQueue && cached.selected === state.selectedWords) return cached.value;
      const next = stepChoiceOf(state, lineId, type);
      const value = cached && sameStepChoice(cached.value, next) ? cached.value : next;
      cacheRef.current = { queue: state.stepQueue, selected: state.selectedWords, value };
      return value;
    },
    [lineId, type],
  );
  return useTimelineStore(select);
}

function useStepTrack(lineId: string, trackType: TrackType): StepTrack {
  const { stepTiming, queuedIndices, chosenLine, chosenBackground } = useStepChoice(lineId, trackType);
  const includeBackground = useSettingsStore((s) => s.stepTimingBackground);
  const nextWordIndex = useStepView((view) =>
    view?.next?.lineId === lineId && view.next.type === trackType ? view.next.wordIndex : -1,
  );
  const skippedLine = useStepView((view) => view?.skippedLineIds.has(lineId) === true);
  const queueActive = useTimelineStore((s) => s.stepQueue !== null);
  // A background lane the keys will not reach fades: outside the queue, or skipped while background vocals are left out.
  const reached = !queueActive && includeBackground;
  const offChain = (skippedLine && !chosenLine) || (stepTiming && trackType === "bg" && !reached && !chosenBackground);
  return {
    stepTiming,
    trackAttributes: { "data-word-track": true, "data-step-chain": offChain ? "off" : undefined },
    nextWordIndex,
    queuedIndices,
  };
}

// -- Exports ------------------------------------------------------------------

export { useStepTrack };
