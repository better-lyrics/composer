import { isResumeSeek } from "@/audio/resume-seek";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { revealTimeScrollLeft } from "@/views/timeline/coords";
import { currentFocusScrollRange } from "@/views/timeline/effective-focus";
import { clampScrollLeft } from "@/views/timeline/group-focus";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { type RefObject, useEffect } from "react";
import { readViewScroll, scrollView } from "@/views/timeline/view-scroll";

// -- Hook ----------------------------------------------------------------------

function useSeekReveal(scrollContainerRef: RefObject<HTMLDivElement | null>, enabled: boolean): void {
  const audio = useAudioStore((s) => s.audioElement);

  useEffect(() => {
    if (!enabled || !audio) return;
    const handleSeeking = () => {
      if (isResumeSeek(audio)) return;
      const container = scrollContainerRef.current;
      if (!container || useProjectStore.getState().activeTab !== "timeline") return;
      const { zoom, isDraggingPlayhead, loopRegionDrag } = useTimelineStore.getState();
      const { followPlayhead } = useSettingsStore.getState();
      if (isDraggingPlayhead || loopRegionDrag || (followPlayhead && !audio.paused)) return;
      const next = revealTimeScrollLeft(audio.currentTime, zoom, readViewScroll(container).left, container.clientWidth);
      if (next === null) return;
      const focusRange = currentFocusScrollRange(container);
      scrollView(container, focusRange ? clampScrollLeft(next, focusRange) : next);
    };
    audio.addEventListener("seeking", handleSeeking);
    return () => audio.removeEventListener("seeking", handleSeeking);
  }, [audio, enabled, scrollContainerRef]);
}

// -- Exports -------------------------------------------------------------------

export { useSeekReveal };
