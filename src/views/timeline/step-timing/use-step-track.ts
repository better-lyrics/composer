import { use } from "react";
import { isWordSelected } from "@/domain/selection/identity";
import type { WordSelection } from "@/domain/selection/model";
import { toggleStepLane } from "@/views/timeline/step-timing/press-step-key";
import { StepNextContext } from "@/views/timeline/step-timing/step-next";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

interface StepTrack {
  stepTiming: boolean;
  trackAttributes: { "data-word-track": true; "data-step-chain"?: "off" };
  toggleLane: (lineIndex: number, wordCount: number) => void;
  isNext: (wordIndex: number) => boolean;
  isQueued: (wordIndex: number) => boolean;
}

// -- Hooks --------------------------------------------------------------------

function useStepTrack(lineId: string, trackType: WordSelection["type"]): StepTrack {
  const stepTiming = useTimelineStore((s) => s.stepTiming);
  const stepQueue = useTimelineStore((s) => s.stepQueue);
  const selectedWords = useTimelineStore((s) => s.selectedWords);
  const stepView = use(StepNextContext);
  const stepNext = stepView?.next;
  const includeBackground = useSettingsStore((s) => s.stepTimingBackground);
  const chosen = stepQueue ?? selectedWords;
  // A background lane the keys will not reach fades: outside the queue, or skipped while background vocals are left out.
  const reached = stepQueue === null && includeBackground;
  const skippedRepeat = stepView?.skippedLineIds.has(lineId) === true && !chosen.some((s) => s.lineId === lineId);
  const offChain =
    skippedRepeat ||
    (stepTiming && trackType === "bg" && !reached && !chosen.some((s) => s.lineId === lineId && s.type === "bg"));
  return {
    stepTiming,
    trackAttributes: {
      "data-word-track": true,
      "data-step-chain": offChain ? "off" : undefined,
    },
    toggleLane: (lineIndex, wordCount) => toggleStepLane(lineId, lineIndex, trackType, wordCount),
    isNext: (wordIndex) =>
      stepNext?.lineId === lineId && stepNext.type === trackType && stepNext.wordIndex === wordIndex,
    isQueued: (wordIndex) => stepQueue !== null && isWordSelected(stepQueue, lineId, wordIndex, trackType),
  };
}

// -- Exports ------------------------------------------------------------------

export { useStepTrack };
