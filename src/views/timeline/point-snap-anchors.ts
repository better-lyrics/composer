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

let cachedPoints: { key: readonly unknown[]; points: GridPoint[] } | null = null;

function visibleBeatPoints(): GridPoint[] {
  const { beatGridVisible, beatGridLines } = useSettingsStore.getState();
  const grid = useProjectStore.getState().beatGrid;
  if (!beatGridVisible || !grid) return [];
  const duration = useAudioStore.getState().duration;
  const zoom = useTimelineStore.getState().zoom;
  const key = [grid, duration, zoom, beatGridLines];
  if (cachedPoints?.key.every((part, i) => part === key[i])) return cachedPoints.points;
  const points = gridPoints(grid, 0, duration, zoom, beatGridLines).filter((point) => point.t >= 0);
  cachedPoints = { key, points };
  return points;
}

function snappableBeatPoints(): GridPoint[] {
  const { timelineSnap, beatSnap } = useSettingsStore.getState();
  return timelineSnap && beatSnap ? visibleBeatPoints() : [];
}

function pointSnapTimes({ includeMarkers, includeOnsets, includeBeats }: PointSnapSources): number[] {
  const { timelineSnap, snapMarkers, vocalOnsetSnap } = useSettingsStore.getState();
  if (!timelineSnap) return [];
  const times: number[] = [];
  if (includeMarkers && snapMarkers) times.push(...snapPointTimes(useProjectStore.getState().customSnapPoints));
  if (includeOnsets && vocalOnsetSnap) times.push(...useTimelineStore.getState().vocalOnsetSnapPoints);
  if (includeBeats) for (const point of snappableBeatPoints()) times.push(point.t);
  return times.toSorted((a, b) => a - b);
}

// -- Exports -------------------------------------------------------------------

export { pointSnapTimes, snappableBeatPoints, visibleBeatPoints };
