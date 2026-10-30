import { snapPointTimes } from "@/domain/snap-point/model";
import type { BeatGrid } from "@/domain/tempo/beat-grid";
import type { GridLines } from "@/domain/tempo/grid-points";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { snapDistancePx } from "@/stores/settings-snap";
import { snappableBeatPoints } from "@/views/timeline/point-snap-anchors";
import {
  type SnapAnchor,
  activeSnapAnchors,
  beatAnchors,
  collectSnapAnchors,
  findSnapShift,
  snapSourceOf,
  vocalOnsetAnchors,
} from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { Modifier } from "@dnd-kit/core";
import { useCallback, useMemo, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface BeginGestureArgs {
  selfIds: Set<string>;
  leaderKey: string;
  overlapCheck: (shift: number) => boolean;
}

interface ActiveAnchorsKey {
  sources: number;
  onsetTimes: readonly number[];
  beatGrid: BeatGrid | null;
  zoom: number;
  beatGridLines: GridLines;
  duration: number;
}

interface SnapCtx {
  allAnchors: SnapAnchor[];
  activeAnchors: SnapAnchor[];
  activeKey: ActiveAnchorsKey | null;
  selfIds: Set<string>;
  leaderKey: string;
  overlapCheck: ((shift: number) => boolean) | null;
  scrollLeftAtStart: number;
}

interface SnapResolution {
  shiftPx: number;
  anchorTime: number | null;
}

interface UseTimelineSnap {
  dragSnapModifier: Modifier;
  syncDragSnap: () => void;
  beginGesture: (args: BeginGestureArgs) => void;
  endGesture: () => void;
  computeShiftPx: (proposedDeltaPx: number, edgesAtStart: number[]) => number;
}

// -- Helpers ------------------------------------------------------------------

function sameActiveKey(a: ActiveAnchorsKey | null, b: ActiveAnchorsKey): boolean {
  return (
    a !== null &&
    a.sources === b.sources &&
    a.onsetTimes === b.onsetTimes &&
    a.beatGrid === b.beatGrid &&
    a.zoom === b.zoom &&
    a.beatGridLines === b.beatGridLines &&
    a.duration === b.duration
  );
}

function sourcesBits(flags: readonly boolean[]): number {
  return flags.reduce((bits, flag, index) => bits | (Number(flag) << index), 0);
}

function writeSnappedLeader(leaderKey: string, anchorTime: number | null): void {
  const store = useTimelineStore.getState();
  if (anchorTime === null) {
    store.setSnappedBlockId(null);
    store.setSnappedAnchorTime(null);
    return;
  }
  store.setSnappedBlockId(leaderKey);
  store.setSnappedAnchorTime(anchorTime);
}

// -- Hook ---------------------------------------------------------------------

function useTimelineSnap(): UseTimelineSnap {
  useSettingsStore((s) => s.timelineSnap);
  useSettingsStore((s) => s.vocalOnsetSnap);
  useSettingsStore((s) => s.beatSnap);
  useSettingsStore((s) => s.beatGridVisible);
  useSettingsStore((s) => s.beatGridLines);
  useSettingsStore((s) => s.snapWordsAndLines);
  useSettingsStore((s) => s.snapMarkers);
  useSettingsStore((s) => s.snapToPlayhead);
  useTimelineStore((s) => s.isBypassing);
  useTimelineStore((s) => s.vocalOnsetSnapPoints);
  // Deliberately NOT subscribing to customSnapPoints. This hook runs in every
  // word-track, and customSnapPoints changes on every frame of a snap-marker
  // drag, so a reactive subscription here would re-render every word block 60+
  // times a second. The gesture reads it via getState() in beginGesture.

  const ctxRef = useRef<SnapCtx>({
    allAnchors: [],
    activeAnchors: [],
    activeKey: null,
    selfIds: new Set(),
    leaderKey: "",
    overlapCheck: null,
    scrollLeftAtStart: 0,
  });
  const pendingDragAnchorRef = useRef<number | null>(null);

  const beginGesture = useCallback((args: BeginGestureArgs) => {
    const lines = useProjectStore.getState().lines;
    const projectSnapPoints = useProjectStore.getState().customSnapPoints;
    const playhead = livePlaybackTime();
    ctxRef.current.allAnchors = collectSnapAnchors(
      lines,
      args.selfIds,
      playhead,
      [],
      snapPointTimes(projectSnapPoints),
    );
    ctxRef.current.activeKey = null;
    ctxRef.current.selfIds = args.selfIds;
    ctxRef.current.leaderKey = args.leaderKey;
    ctxRef.current.overlapCheck = args.overlapCheck;
    ctxRef.current.scrollLeftAtStart = useTimelineStore.getState().scrollLeft;
  }, []);

  const endGesture = useCallback(() => {
    ctxRef.current.allAnchors = [];
    ctxRef.current.activeAnchors = [];
    ctxRef.current.activeKey = null;
    ctxRef.current.selfIds = new Set();
    ctxRef.current.leaderKey = "";
    ctxRef.current.overlapCheck = null;
    ctxRef.current.scrollLeftAtStart = 0;
    pendingDragAnchorRef.current = null;
    writeSnappedLeader("", null);
  }, []);

  const scrolledSinceStartPx = useCallback(
    () => useTimelineStore.getState().scrollLeft - ctxRef.current.scrollLeftAtStart,
    [],
  );

  const resolveSnap = useCallback((proposedDeltaPx: number, edgesAtStart: number[]): SnapResolution => {
    const ctx = ctxRef.current;
    const settings = useSettingsStore.getState();
    const { timelineSnap, vocalOnsetSnap, beatSnap, beatGridVisible, snapWordsAndLines, snapMarkers, snapToPlayhead } =
      settings;
    const { zoom, isBypassing, vocalOnsetSnapPoints } = useTimelineStore.getState();
    const key: ActiveAnchorsKey = {
      sources: sourcesBits([
        timelineSnap,
        vocalOnsetSnap,
        beatSnap,
        beatGridVisible,
        snapWordsAndLines,
        snapMarkers,
        snapToPlayhead,
      ]),
      onsetTimes: vocalOnsetSnapPoints,
      beatGrid: useProjectStore.getState().beatGrid,
      zoom,
      beatGridLines: settings.beatGridLines,
      duration: useAudioStore.getState().duration,
    };
    if (!sameActiveKey(ctx.activeKey, key)) {
      let anchors = ctx.allAnchors;
      if (timelineSnap && vocalOnsetSnap) anchors = anchors.concat(vocalOnsetAnchors(vocalOnsetSnapPoints));
      anchors = anchors.concat(beatAnchors(snappableBeatPoints()));
      ctx.activeAnchors = activeSnapAnchors(anchors, {
        timelineSnap,
        vocalOnsetSnap,
        beatSnap,
        snapWordsAndLines,
        snapMarkers,
        snapToPlayhead,
      });
      ctx.activeKey = key;
    }
    if (isBypassing || ctx.activeAnchors.length === 0) return { shiftPx: 0, anchorTime: null };
    const deltaT = proposedDeltaPx / zoom;
    const proposedEdges = edgesAtStart.map((edge) => edge + deltaT);
    const overlapCheck = ctx.overlapCheck;
    const result = findSnapShift({
      edges: proposedEdges,
      anchors: ctx.activeAnchors,
      zoom,
      thresholdPx: (anchor) => snapDistancePx(settings, snapSourceOf(anchor.kind)),
      overlapCheck: overlapCheck ? (shift) => overlapCheck(shift) : undefined,
    });
    return { shiftPx: result.shift * zoom, anchorTime: result.anchor ? result.anchor.t : null };
  }, []);

  const computeShiftPx = useCallback(
    (proposedDeltaPx: number, edgesAtStart: number[]): number => {
      const { shiftPx, anchorTime } = resolveSnap(proposedDeltaPx, edgesAtStart);
      writeSnappedLeader(ctxRef.current.leaderKey, anchorTime);
      return shiftPx;
    },
    [resolveSnap],
  );

  // dnd-kit runs modifiers while rendering, so the snapped leader is published from onDragMove instead.
  const syncDragSnap = useCallback(() => {
    writeSnappedLeader(ctxRef.current.leaderKey, pendingDragAnchorRef.current);
  }, []);

  // dnd-kit hands modifiers the pointer translate before it adds the scroll delta, but drops with both.
  const dragSnapModifier = useMemo<Modifier>(
    () =>
      ({ transform, active }) => {
        const data = active?.data.current as { snap?: { edgesAtStart: number[] } } | undefined;
        if (!data?.snap) return transform;
        const { shiftPx, anchorTime } = resolveSnap(transform.x + scrolledSinceStartPx(), data.snap.edgesAtStart);
        pendingDragAnchorRef.current = anchorTime;
        if (shiftPx === 0) return transform;
        return { ...transform, x: transform.x + shiftPx };
      },
    [resolveSnap, scrolledSinceStartPx],
  );

  return { dragSnapModifier, beginGesture, endGesture, computeShiftPx, syncDragSnap };
}

// -- Exports ------------------------------------------------------------------

export { useTimelineSnap };
