import { useCallback, useRef } from "react";
import type { SyllableAddress } from "@/domain/selection/model";
import { useSettingsStore } from "@/stores/settings";
import { useStepView } from "@/views/timeline/step-timing/step-next";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

type TrackType = SyllableAddress["type"];

interface StepTrack {
  stepTiming: boolean;
  trackAttributes: { "data-word-track": true; "data-step-chain"?: "off" };
  nextWordIndex: number;
  queuedIds: ReadonlySet<string>;
}

interface StepChoice {
  stepTiming: boolean;
  queuedIds: ReadonlySet<string>;
  chosenLine: boolean;
  chosenBackground: boolean;
}

interface StepChoiceSource {
  stepTiming: boolean;
  stepQueue: SyllableAddress[] | null;
  selectedWords: SyllableAddress[];
}

// -- Constants ----------------------------------------------------------------

const NO_IDS: ReadonlySet<string> = new Set();
const STEP_OFF: StepChoice = {
  stepTiming: false,
  queuedIds: NO_IDS,
  chosenLine: false,
  chosenBackground: false,
};

// -- Helpers ------------------------------------------------------------------

function stepChoiceOf(state: StepChoiceSource, lineId: string, type: TrackType): StepChoice {
  if (!state.stepTiming) return STEP_OFF;
  let queued: Set<string> | null = null;
  for (const queuedWord of state.stepQueue ?? []) {
    if (queuedWord.lineId !== lineId || queuedWord.type !== type) continue;
    queued ??= new Set();
    queued.add(queuedWord.syllableId);
  }
  const chosen = state.stepQueue ?? state.selectedWords;
  return {
    stepTiming: true,
    queuedIds: queued ?? NO_IDS,
    chosenLine: chosen.some((s) => s.lineId === lineId),
    chosenBackground: chosen.some((s) => s.lineId === lineId && s.type === "bg"),
  };
}

function sameStepChoice(a: StepChoice, b: StepChoice): boolean {
  if (a.stepTiming !== b.stepTiming || a.chosenLine !== b.chosenLine || a.chosenBackground !== b.chosenBackground)
    return false;
  if (a.queuedIds.size !== b.queuedIds.size) return false;
  for (const id of a.queuedIds) if (!b.queuedIds.has(id)) return false;
  return true;
}

// -- Hooks --------------------------------------------------------------------

// Keeps its previous value while this track's part of the step choice is unchanged, so a step elsewhere never re-renders it.
function useStepChoice(lineId: string, type: TrackType): StepChoice {
  const cacheRef = useRef<{ queue: SyllableAddress[] | null; selected: SyllableAddress[]; value: StepChoice } | null>(
    null,
  );
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
  const { stepTiming, queuedIds, chosenLine, chosenBackground } = useStepChoice(lineId, trackType);
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
    queuedIds,
  };
}

// -- Exports ------------------------------------------------------------------

export { useStepTrack };
