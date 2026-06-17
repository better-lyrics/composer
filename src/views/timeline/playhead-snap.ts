import { snapPointTimes } from "@/domain/snap-point/model";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { snapTimeToOnset } from "@/views/timeline/snap-marker-math";
import { useTimelineStore } from "@/views/timeline/timeline-store";

function snapPlayheadTime(time: number, bypass: boolean): number {
  if (bypass) return time;
  const { snapPlayheadToPoints, vocalOnsetSnap, timelineSnapThreshold } = useSettingsStore.getState();
  if (!snapPlayheadToPoints) return time;
  const { zoom, vocalOnsetSnapPoints } = useTimelineStore.getState();
  const pins = snapPointTimes(useProjectStore.getState().customSnapPoints);
  const anchors = vocalOnsetSnap ? [...pins, ...vocalOnsetSnapPoints] : pins;
  if (anchors.length === 0) return time;
  return snapTimeToOnset(time, anchors, zoom, timelineSnapThreshold);
}

export { snapPlayheadTime };
