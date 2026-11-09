import { noteGuideSignal } from "@/lib/guide-signals";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- API ----------------------------------------------------------------------

// Keyed by the half second the playhead is put at, so returning to one spot again and again reads as one place.
function noteReplaySpot(time: number): void {
  if (useProjectStore.getState().activeTab !== "timeline" || useTimelineStore.getState().loopRegion !== null) return;
  noteGuideSignal("timeline.replaySameSpot", String(Math.round(time * 2)));
}

// -- Exports ------------------------------------------------------------------

export { noteReplaySpot };
