import type { ResumePosition } from "@/domain/project/resume-position";
import { centerTimeScrollLeft } from "@/views/timeline/coords";
import { createFollowInput, fillFollowInput } from "@/views/timeline/follow-input";
import { createRowLayoutCache } from "@/views/timeline/row-layout-cache";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { createFollowMemory, followScrollTop, followStep } from "@/views/timeline/vertical-follow";
import { type RefObject, useEffect } from "react";

// -- Helpers ------------------------------------------------------------------

// Without a saved scroll, frame the playhead the way follow mode does when playback starts.
function resumeScroll(container: HTMLElement, view: ResumePosition): void {
  if (view.scroll) {
    container.scrollLeft = view.scroll.left;
    container.scrollTop = view.scroll.top;
    return;
  }
  container.scrollLeft = centerTimeScrollLeft(view.time, view.zoom, container.clientWidth);
  const input = fillFollowInput(createFollowInput(), createRowLayoutCache(), view.time, container.clientHeight);
  const rows = followStep(createFollowMemory(), input);
  container.scrollTop = rows ? followScrollTop(rows, input, container.scrollHeight) : 0;
}

// -- Hook ---------------------------------------------------------------------

function useResumeView(scrollContainerRef: RefObject<HTMLDivElement | null>, ready: boolean): void {
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!ready || !container) return;
    const apply = () => {
      if (container.clientWidth === 0) return;
      const { pendingResumeView, setPendingResumeView, scrollTop } = useTimelineStore.getState();
      if (pendingResumeView) {
        setPendingResumeView(null);
        resumeScroll(container, pendingResumeView);
      } else if (scrollTop !== null) {
        return;
      }
      // A view that never scrolls fires no scroll event, so record it once it is on screen.
      const { setScrollLeft, setScrollTop } = useTimelineStore.getState();
      setScrollLeft(container.scrollLeft);
      setScrollTop(container.scrollTop);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(container);
    return () => observer.disconnect();
  }, [scrollContainerRef, ready]);
}

// -- Exports ------------------------------------------------------------------

export { useResumeView };
