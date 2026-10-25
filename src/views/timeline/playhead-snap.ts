import { useSettingsStore } from "@/stores/settings";
import { pointSnapTimes } from "@/views/timeline/point-snap-anchors";
import { snapTimeToOnset } from "@/views/timeline/snap-marker-math";
import { useTimelineStore } from "@/views/timeline/timeline-store";

function snapPlayheadTime(time: number, bypass: boolean): number {
  if (bypass) return time;
  const { snapPlayheadToPoints, timelineSnapThreshold } = useSettingsStore.getState();
  if (!snapPlayheadToPoints) return time;
  const anchors = pointSnapTimes({ includeMarkers: true, includeOnsets: true, includeBeats: true });
  if (anchors.length === 0) return time;
  return snapTimeToOnset(time, anchors, useTimelineStore.getState().zoom, timelineSnapThreshold);
}

export { snapPlayheadTime };
