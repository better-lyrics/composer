import { useProjectStore } from "@/stores/project";
import { pointSnapAnchors } from "@/views/timeline/point-snap-anchors";
import { snapTimeToPoints } from "@/views/timeline/snap-marker-math";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions ----------------------------------------------------------------

function placeSnapPoint(time: number): void {
  const anchors = pointSnapAnchors({ includeMarkers: false, includeOnsets: true, includeBeats: true });
  const { zoom } = useTimelineStore.getState();
  useProjectStore.getState().addCustomSnapPoint(snapTimeToPoints(time, anchors, zoom));
}

// -- Exports ------------------------------------------------------------------

export { placeSnapPoint };
