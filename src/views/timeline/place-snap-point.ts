import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { snapTimeToOnset } from "@/views/timeline/snap-marker-math";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions ----------------------------------------------------------------

// A placed marker lands on a nearby vocal onset when onset snapping is on.
function placeSnapPoint(time: number): void {
  const { zoom, vocalOnsetSnapPoints } = useTimelineStore.getState();
  const { vocalOnsetSnap, timelineSnapThreshold } = useSettingsStore.getState();
  const onsets = vocalOnsetSnap ? vocalOnsetSnapPoints : [];
  useProjectStore.getState().addCustomSnapPoint(snapTimeToOnset(time, onsets, zoom, timelineSnapThreshold));
}

// -- Exports ------------------------------------------------------------------

export { placeSnapPoint };
