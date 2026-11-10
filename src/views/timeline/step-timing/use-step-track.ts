import { use } from "react";
import { isWordSelected } from "@/domain/selection/identity";
import type { WordSelection } from "@/domain/selection/model";
import { toggleStepLane } from "@/views/timeline/step-timing/press-step-key";
import { StepNextContext } from "@/views/timeline/step-timing/step-next";
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
  const stepNext = use(StepNextContext);
  const chosen = stepQueue ?? selectedWords;
  // A background lane outside the queue and the cursor is off the chain, and fades.
  const offChain = stepTiming && trackType === "bg" && !chosen.some((s) => s.lineId === lineId && s.type === "bg");
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
