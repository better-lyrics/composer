import { noteGuideSignal } from "@/lib/guide-signals";
import { computeAnchoredScrollLeft } from "@/utils/timeline/zoom-anchor";
import { playheadTime } from "@/views/timeline/playhead-time";
import { GUTTER_WIDTH, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, useTimelineStore } from "@/views/timeline/timeline-store";
import { type RefObject, useCallback } from "react";
import { readViewScroll } from "@/views/timeline/view-scroll";
import { zoomView } from "@/views/timeline/zoom-view";

// -- Helpers -------------------------------------------------------------------

function pickAnchor(
  currentTime: number,
  oldZoom: number,
  scrollLeft: number,
  contentWidthInView: number,
): { anchorTime: number; anchorViewportX: number } {
  const playheadViewportX = currentTime * oldZoom - scrollLeft;
  if (playheadViewportX >= 0 && playheadViewportX <= contentWidthInView) {
    return { anchorTime: currentTime, anchorViewportX: playheadViewportX };
  }
  const anchorViewportX = contentWidthInView / 2;
  const anchorTime = (anchorViewportX + scrollLeft) / oldZoom;
  return { anchorTime, anchorViewportX };
}

// -- Hook ----------------------------------------------------------------------

function useTimelineZoom(scrollContainerRef: RefObject<HTMLDivElement | null>) {
  const applyZoom = useCallback(
    (newZoom: number) => {
      const oldZoom = useTimelineStore.getState().zoom;
      if (newZoom === oldZoom) return;

      const container = scrollContainerRef.current;
      if (!container) {
        useTimelineStore.getState().setZoom(newZoom);
        return;
      }

      const contentWidthInView = Math.max(0, container.clientWidth - GUTTER_WIDTH);
      const { anchorTime, anchorViewportX } = pickAnchor(
        playheadTime(),
        oldZoom,
        readViewScroll(container).left,
        contentWidthInView,
      );
      zoomView(container, newZoom, computeAnchoredScrollLeft(anchorTime, anchorViewportX, newZoom));
    },
    [scrollContainerRef],
  );

  const zoomIn = useCallback(() => {
    const z = useTimelineStore.getState().zoom;
    applyZoom(Math.min(MAX_ZOOM, z + ZOOM_STEP));
    noteGuideSignal("timeline.zoomButton");
  }, [applyZoom]);

  const zoomOut = useCallback(() => {
    const z = useTimelineStore.getState().zoom;
    applyZoom(Math.max(MIN_ZOOM, z - ZOOM_STEP));
    noteGuideSignal("timeline.zoomButton");
  }, [applyZoom]);

  return { zoomIn, zoomOut };
}

// -- Exports -------------------------------------------------------------------

export { useTimelineZoom };
