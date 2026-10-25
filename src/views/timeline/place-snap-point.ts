import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { pointSnapTimes } from "@/views/timeline/point-snap-anchors";
import { snapTimeToOnset } from "@/views/timeline/snap-marker-math";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions ----------------------------------------------------------------

function placeSnapPoint(time: number): void {
  const anchors = pointSnapTimes({ includeMarkers: false, includeOnsets: true, includeBeats: true });
  const { zoom } = useTimelineStore.getState();
  const { timelineSnapThreshold } = useSettingsStore.getState();
  useProjectStore.getState().addCustomSnapPoint(snapTimeToOnset(time, anchors, zoom, timelineSnapThreshold));
}

// -- Exports ------------------------------------------------------------------

export { placeSnapPoint };
