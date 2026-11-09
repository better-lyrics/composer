import { livePlaybackTime } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- API ----------------------------------------------------------------------

// A playhead drag only seeks on release, so anything "at the playhead" reads the dragged time meanwhile.
function playheadTime(): number {
  const { isDraggingPlayhead, dragTime } = useTimelineStore.getState();
  return isDraggingPlayhead ? dragTime : livePlaybackTime();
}

// -- Exports ------------------------------------------------------------------

export { playheadTime };
