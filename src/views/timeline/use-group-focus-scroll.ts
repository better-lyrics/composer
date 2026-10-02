import { cancelNextFrame, nextFrame } from "@/lib/frame-loop";
import { useProjectStore } from "@/stores/project";
import { currentFocusScrollRange, scrollToFocusStart, useEffectiveFocus } from "@/views/timeline/effective-focus";
import { type GroupFocus, clampScrollLeft, fittedFocusZoom, focusBounds } from "@/views/timeline/group-focus";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { type RefObject, useEffect, useRef } from "react";

// -- Helpers -------------------------------------------------------------------

function fitZoomToFocus(container: HTMLElement, focus: GroupFocus): void {
  const bounds = focusBounds(useProjectStore.getState().lines, focus);
  const zoom = bounds ? fittedFocusZoom(bounds, container.clientWidth - GUTTER_WIDTH) : null;
  if (zoom !== null) useTimelineStore.getState().setZoom(zoom);
}

// -- Hook ----------------------------------------------------------------------

// Opening a group zooms the Timeline to fit the instance and closing it restores the song's zoom.
function useGroupFocusScroll(scrollContainerRef: RefObject<HTMLDivElement | null>): void {
  const focusedGroup = useEffectiveFocus();
  const previousFocusRef = useRef<GroupFocus | null>(null);
  const songZoomRef = useRef<number | null>(null);

  useEffect(() => {
    const previous = previousFocusRef.current;
    previousFocusRef.current = focusedGroup;
    const container = scrollContainerRef.current;
    if (!container) return;
    if (focusedGroup === null) {
      if (!previous) return;
      if (songZoomRef.current !== null) useTimelineStore.getState().setZoom(songZoomRef.current);
      songZoomRef.current = null;
      const frame = nextFrame(() => scrollToInstanceHeader(previous.groupId, previous.hearInstanceIdx));
      return () => cancelNextFrame(frame);
    }
    if (previous === null) {
      songZoomRef.current = useTimelineStore.getState().zoom;
      fitZoomToFocus(container, focusedGroup);
    }
    scrollToFocusStart(container);
    const frame = nextFrame(() => scrollToFocusStart(container));

    const keepInsideInstance = () => {
      const current = currentFocusScrollRange(container);
      if (!current) return;
      const clamped = clampScrollLeft(container.scrollLeft, current);
      if (clamped !== container.scrollLeft) container.scrollLeft = clamped;
    };
    container.addEventListener("scroll", keepInsideInstance);
    return () => {
      cancelNextFrame(frame);
      container.removeEventListener("scroll", keepInsideInstance);
    };
  }, [focusedGroup, scrollContainerRef]);
}

// -- Exports -------------------------------------------------------------------

export { useGroupFocusScroll };
