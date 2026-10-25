import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { revealTimeScrollLeft } from "@/views/timeline/coords";
import { currentFocusScrollRange } from "@/views/timeline/effective-focus";
import { clampScrollLeft } from "@/views/timeline/group-focus";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { type RefObject, useEffect } from "react";

// -- Hook ----------------------------------------------------------------------

function useSeekReveal(scrollContainerRef: RefObject<HTMLDivElement | null>, enabled: boolean): void {
  const audio = useAudioStore((s) => s.audioElement);

  useEffect(() => {
    if (!enabled || !audio) return;
    const handleSeeking = () => {
      const container = scrollContainerRef.current;
      if (!container || useProjectStore.getState().activeTab !== "timeline") return;
      const { zoom, followEnabled, isDraggingPlayhead, loopRegionDrag } = useTimelineStore.getState();
      if (isDraggingPlayhead || loopRegionDrag || (followEnabled && !audio.paused)) return;
      const next = revealTimeScrollLeft(audio.currentTime, zoom, container.scrollLeft, container.clientWidth);
      if (next === null) return;
      const focusRange = currentFocusScrollRange(container);
      container.scrollLeft = focusRange ? clampScrollLeft(next, focusRange) : next;
    };
    audio.addEventListener("seeking", handleSeeking);
    return () => audio.removeEventListener("seeking", handleSeeking);
  }, [audio, enabled, scrollContainerRef]);
}

// -- Exports -------------------------------------------------------------------

export { useSeekReveal };
