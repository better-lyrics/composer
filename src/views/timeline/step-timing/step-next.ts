import { createContext, useMemo } from "react";
import type { ReadableLine } from "@/domain/line/effective-words";
import type { WordSelection } from "@/domain/selection/model";
import { nextCursorSlot } from "@/domain/step-timing/step-cursor";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { effectiveFocus, isInFocus } from "@/views/timeline/group-focus";
import { type StepSkipView, stepSkipView } from "@/views/timeline/step-timing/step-skip-view";
import { liveStepSelection } from "@/views/timeline/step-timing/step-selection";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Types --------------------------------------------------------------------

interface StepView extends StepSkipView {
  next: WordSelection | null;
}

// -- Context ------------------------------------------------------------------

const StepNextContext = createContext<StepView | null>(null);

// -- Hooks --------------------------------------------------------------------

function useStepNext(lines: readonly ReadableLine[]): StepView | null {
  const stepTiming = useTimelineStore((s) => s.stepTiming);
  const selected = useTimelineStore((s) => s.selectedWords);
  const focusedGroup = useTimelineStore((s) => s.focusedGroup);
  const queue = useTimelineStore((s) => s.stepQueue);
  const collapsedInstances = useTimelineStore((s) => s.collapsedInstances);
  const groups = useProjectStore((s) => s.groups);
  const withBackground = useSettingsStore((s) => s.stepTimingBackground);
  return useMemo(() => {
    if (!stepTiming) return null;
    const live = liveStepSelection(lines, selected, queue);
    const skip = stepSkipView(lines, groups, collapsedInstances, live.cursor ? lines[live.cursor.lineIndex] : null);
    if (!live.cursor) return { ...skip, next: null };
    const focus = effectiveFocus(lines, focusedGroup);
    const include = (line: ReadableLine) => isInFocus(line, focus) && !skip.skippedLineIds.has(line.id);
    return { ...skip, next: nextCursorSlot(lines, live.cursor, live.queue, include, withBackground) };
  }, [stepTiming, selected, queue, lines, focusedGroup, groups, collapsedInstances, withBackground]);
}

// -- Exports ------------------------------------------------------------------

export type { StepView };
export { StepNextContext, useStepNext };
