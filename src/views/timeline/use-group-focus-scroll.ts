import { useProjectStore } from "@/stores/project";
import {
  type GroupFocus,
  type ScrollRange,
  clampScrollLeft,
  focusBounds,
  focusScrollRange,
} from "@/views/timeline/group-focus";
import { useEffectiveFocus } from "@/views/timeline/effective-focus";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { type RefObject, useEffect, useRef } from "react";

// -- Helpers -------------------------------------------------------------------

function focusedScrollRange(container: HTMLElement, focus: GroupFocus): ScrollRange | null {
  const bounds = focusBounds(useProjectStore.getState().lines, focus);
  if (!bounds) return null;
  return focusScrollRange(bounds, useTimelineStore.getState().zoom, container.clientWidth - GUTTER_WIDTH);
}

// -- Hook ----------------------------------------------------------------------

function useGroupFocusScroll(scrollContainerRef: RefObject<HTMLDivElement | null>): void {
  const focusedGroup = useEffectiveFocus();
  const previousFocusRef = useRef<GroupFocus | null>(null);

  useEffect(() => {
    const previous = previousFocusRef.current;
    previousFocusRef.current = focusedGroup;
    const container = scrollContainerRef.current;
    if (!container) return;
    if (focusedGroup === null) {
      if (previous) scrollToInstanceHeader(previous.groupId, previous.hearInstanceIdx);
      return;
    }
    const range = focusedScrollRange(container, focusedGroup);
    container.scrollTop = 0;
    if (range) container.scrollLeft = range.min;

    const keepInsideInstance = () => {
      const current = focusedScrollRange(container, focusedGroup);
      if (!current) return;
      const clamped = clampScrollLeft(container.scrollLeft, current);
      if (clamped !== container.scrollLeft) container.scrollLeft = clamped;
    };
    container.addEventListener("scroll", keepInsideInstance);
    return () => container.removeEventListener("scroll", keepInsideInstance);
  }, [focusedGroup, scrollContainerRef]);
}

// -- Exports -------------------------------------------------------------------

export { useGroupFocusScroll };
