import { snapPointTimes } from "@/domain/snap-point/model";
import { type GridPoint, gridPoints } from "@/domain/tempo/grid-points";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Interfaces ----------------------------------------------------------------

interface PointSnapSources {
  includeMarkers: boolean;
  includeOnsets: boolean;
  includeBeats: boolean;
}

// -- Functions -----------------------------------------------------------------

function snappableBeatPoints(): GridPoint[] {
  const { timelineSnap, beatSnap, beatGridVisible, beatGridLines } = useSettingsStore.getState();
  const grid = useProjectStore.getState().beatGrid;
  if (!timelineSnap || !beatSnap || !beatGridVisible || !grid) return [];
  const duration = useAudioStore.getState().duration;
  return gridPoints(grid, 0, duration, useTimelineStore.getState().zoom, beatGridLines);
}

function pointSnapTimes({ includeMarkers, includeOnsets, includeBeats }: PointSnapSources): number[] {
  const { timelineSnap, snapMarkers, vocalOnsetSnap } = useSettingsStore.getState();
  if (!timelineSnap) return [];
  const times: number[] = [];
  if (includeMarkers && snapMarkers) times.push(...snapPointTimes(useProjectStore.getState().customSnapPoints));
  if (includeOnsets && vocalOnsetSnap) times.push(...useTimelineStore.getState().vocalOnsetSnapPoints);
  if (includeBeats) for (const point of snappableBeatPoints()) times.push(point.t);
  return times.sort((a, b) => a - b);
}

// -- Exports -------------------------------------------------------------------

export { pointSnapTimes, snappableBeatPoints };
