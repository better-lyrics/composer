import { createContext, useMemo } from "react";
import type { ReadableLine } from "@/domain/line/effective-words";
import type { WordSelection } from "@/domain/selection/model";
import { nextCursorSlot } from "@/domain/step-timing/step-cursor";
import { effectiveFocus, isInFocus } from "@/views/timeline/group-focus";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Context ------------------------------------------------------------------

const StepNextContext = createContext<WordSelection | null>(null);

// -- Hooks --------------------------------------------------------------------

function useStepNext(lines: readonly ReadableLine[]): WordSelection | null {
  const stepTiming = useTimelineStore((s) => s.stepTiming);
  const cursor = useTimelineStore((s) => s.selectedWords[0] ?? null);
  const focusedGroup = useTimelineStore((s) => s.focusedGroup);
  const queue = useTimelineStore((s) => s.stepQueue);
  return useMemo(() => {
    if (!stepTiming || !cursor) return null;
    const focus = effectiveFocus(lines, focusedGroup);
    return nextCursorSlot(lines, cursor, queue, (line) => isInFocus(line, focus));
  }, [stepTiming, cursor, queue, lines, focusedGroup]);
}

// -- Exports ------------------------------------------------------------------

export { StepNextContext, useStepNext };
