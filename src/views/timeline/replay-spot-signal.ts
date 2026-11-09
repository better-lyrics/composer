import { noteGuideSignal } from "@/lib/guide-signals";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- API ----------------------------------------------------------------------

// Keyed by the time in seconds; the trigger treats times close together as one spot.
function noteReplaySpot(time: number): void {
  if (useProjectStore.getState().activeTab !== "timeline" || useTimelineStore.getState().loopRegion !== null) return;
  noteGuideSignal("timeline.replaySameSpot", String(time));
}

// -- Exports ------------------------------------------------------------------

export { noteReplaySpot };
