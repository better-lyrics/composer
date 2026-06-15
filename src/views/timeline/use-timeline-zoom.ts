import { useAudioStore } from "@/stores/audio";
import { computeAnchoredScrollLeft } from "@/utils/timeline/zoom-anchor";
import { GUTTER_WIDTH, MAX_ZOOM, MIN_ZOOM, useTimelineStore, ZOOM_STEP } from "@/views/timeline/timeline-store";
import { type RefObject, useCallback } from "react";

// -- Helpers -------------------------------------------------------------------

function readCurrentTime(): number {
  const audio = useAudioStore.getState();
  return audio.audioElement?.currentTime ?? audio.currentTime;
}

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
      useTimelineStore.getState().setZoom(newZoom);
      if (!container) return;

      const contentWidthInView = Math.max(0, container.clientWidth - GUTTER_WIDTH);
      const { anchorTime, anchorViewportX } = pickAnchor(
        readCurrentTime(),
        oldZoom,
        container.scrollLeft,
        contentWidthInView,
      );
      container.scrollLeft = computeAnchoredScrollLeft(anchorTime, anchorViewportX, newZoom);
    },
    [scrollContainerRef],
  );

  const zoomIn = useCallback(() => {
    const z = useTimelineStore.getState().zoom;
    applyZoom(Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, [applyZoom]);

  const zoomOut = useCallback(() => {
    const z = useTimelineStore.getState().zoom;
    applyZoom(Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, [applyZoom]);

  return { zoomIn, zoomOut };
}

// -- Exports -------------------------------------------------------------------

export { useTimelineZoom };
