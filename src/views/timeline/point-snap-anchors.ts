import { snapPointTimes } from "@/domain/snap-point/model";
import { type GridPoint, gridPoints } from "@/domain/tempo/grid-points";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { type SnapSource, snapDistancePx } from "@/stores/settings-snap";
import { type SnapAnchor, activeSnapAnchors, beatAnchors, snapSourceOf, vocalOnsetAnchors } from "@/views/timeline/snap";
import type { PointSnapAnchor } from "@/views/timeline/snap-marker-math";
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

function pointSnapAnchors({ includeMarkers, includeOnsets, includeBeats }: PointSnapSources): PointSnapAnchor[] {
  const settings = useSettingsStore.getState();
  if (!settings.timelineSnap) return [];
  const anchors: PointSnapAnchor[] = [];
  const add = (times: Iterable<number>, source: SnapSource) => {
    const thresholdPx = snapDistancePx(settings, source);
    for (const t of times) anchors.push({ t, thresholdPx });
  };
  if (includeMarkers && settings.snapMarkers)
    add(snapPointTimes(useProjectStore.getState().customSnapPoints), "markers");
  if (includeOnsets && settings.vocalOnsetSnap) add(useTimelineStore.getState().vocalOnsetSnapPoints, "onsets");
  if (includeBeats)
    add(
      snappableBeatPoints().map((point) => point.t),
      "beats",
    );
  return anchors.toSorted((a, b) => a.t - b.t);
}

function liveSnapAnchors(base: SnapAnchor[]): SnapAnchor[] {
  const settings = useSettingsStore.getState();
  let anchors = base;
  if (settings.timelineSnap && settings.vocalOnsetSnap)
    anchors = anchors.concat(vocalOnsetAnchors(useTimelineStore.getState().vocalOnsetSnapPoints));
  anchors = anchors.concat(beatAnchors(snappableBeatPoints()));
  return activeSnapAnchors(anchors, settings);
}

function snapThresholdPx(anchor: SnapAnchor): number {
  return snapDistancePx(useSettingsStore.getState(), snapSourceOf(anchor.kind));
}

// -- Exports -------------------------------------------------------------------

export { liveSnapAnchors, pointSnapAnchors, snappableBeatPoints, snapThresholdPx, visibleBeatPoints };
