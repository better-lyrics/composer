import { useSettingsStore } from "@/stores/settings";
import { pointSnapAnchors } from "@/views/timeline/point-snap-anchors";
import { snapTimeToPoints } from "@/views/timeline/snap-marker-math";
import { useTimelineStore } from "@/views/timeline/timeline-store";

function snapPlayheadTime(time: number, bypass: boolean): number {
  if (bypass) return time;
  if (!useSettingsStore.getState().snapPlayheadToPoints) return time;
  const anchors = pointSnapAnchors({ includeMarkers: true, includeOnsets: true, includeBeats: true });
  if (anchors.length === 0) return time;
  return snapTimeToPoints(time, anchors, useTimelineStore.getState().zoom);
}

export { snapPlayheadTime };
