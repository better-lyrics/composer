import { useProjectStore } from "@/stores/project";
import {
  type GroupFocus,
  type ScrollRange,
  effectiveFocus,
  focusBounds,
  focusScrollRange,
} from "@/views/timeline/group-focus";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions ----------------------------------------------------------------

function currentEffectiveFocus(): GroupFocus | null {
  return effectiveFocus(useProjectStore.getState().lines, useTimelineStore.getState().focusedGroup);
}

function currentFocusScrollRange(container: HTMLElement): ScrollRange | null {
  const focus = currentEffectiveFocus();
  if (focus === null) return null;
  const bounds = focusBounds(useProjectStore.getState().lines, focus);
  if (!bounds) return null;
  return focusScrollRange(bounds, useTimelineStore.getState().zoom, container.clientWidth - GUTTER_WIDTH);
}

function scrollToFocusStart(container: HTMLElement): void {
  const range = currentFocusScrollRange(container);
  container.scrollTop = 0;
  if (range) container.scrollLeft = range.min;
}

// -- Hooks --------------------------------------------------------------------

function useEffectiveFocus(): GroupFocus | null {
  const focusedGroup = useTimelineStore((s) => s.focusedGroup);
  return useProjectStore((s) => effectiveFocus(s.lines, focusedGroup));
}

// -- Exports ------------------------------------------------------------------

export { currentEffectiveFocus, currentFocusScrollRange, scrollToFocusStart, useEffectiveFocus };
