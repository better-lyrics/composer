import { useLayoutEffect, useMemo, useSyncExternalStore } from "react";
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

// -- Constants ----------------------------------------------------------------

const NO_SELECTION: WordSelection[] = [];

// -- State --------------------------------------------------------------------

// One step view for the whole Timeline: rows read their own slice of it, so a step re-renders only the rows it touches.
let shownView: StepView | null = null;
const listeners = new Set<() => void>();

// -- Functions ----------------------------------------------------------------

function publishStepView(view: StepView | null): void {
  if (view === shownView) return;
  shownView = view;
  for (const listener of listeners) listener();
}

function subscribeStepView(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// -- Hooks --------------------------------------------------------------------

function useStepNext(lines: readonly ReadableLine[]): StepView | null {
  const stepTiming = useTimelineStore((s) => s.stepTiming);
  const selected = useTimelineStore((s) => (s.stepTiming ? s.selectedWords : NO_SELECTION));
  const focusedGroup = useTimelineStore((s) => (s.stepTiming ? s.focusedGroup : null));
  const queue = useTimelineStore((s) => (s.stepTiming ? s.stepQueue : null));
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

// The selector must return a primitive or a stable value, or every reader re-renders on each publish.
function useStepView<T>(select: (view: StepView | null) => T): T {
  return useSyncExternalStore(subscribeStepView, () => select(shownView));
}

// -- Components ---------------------------------------------------------------

const StepViewPublisher: React.FC<{ lines: readonly ReadableLine[] }> = ({ lines }) => {
  const view = useStepNext(lines);
  useLayoutEffect(() => publishStepView(view), [view]);
  useLayoutEffect(() => () => publishStepView(null), []);
  return null;
};

// -- Exports ------------------------------------------------------------------

export type { StepView };
export { StepViewPublisher, useStepView };
