import { snapPointTimes } from "@/domain/snap-point/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { type SnapAnchor, collectSnapAnchors, findSnapShift } from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { Modifier } from "@dnd-kit/core";
import { useCallback, useMemo, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface BeginGestureArgs {
  selfIds: Set<string>;
  leaderKey: string;
  overlapCheck: (shift: number) => boolean;
}

interface SnapCtx {
  anchors: SnapAnchor[];
  selfIds: Set<string>;
  leaderKey: string;
  overlapCheck: ((shift: number) => boolean) | null;
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
  useTimelineStore((s) => s.zoom);
  useTimelineStore((s) => s.isBypassing);
  useTimelineStore((s) => s.vocalOnsetSnapPoints);
  // Deliberately NOT subscribing to customSnapPoints. This hook runs in every
  // word-track, and customSnapPoints changes on every frame of a snap-marker
  // drag, so a reactive subscription here would re-render every word block 60+
  // times a second. The gesture reads it via getState() in beginGesture.

  const ctxRef = useRef<SnapCtx>({
    anchors: [],
    selfIds: new Set(),
    leaderKey: "",
    overlapCheck: null,
  });
  const pendingDragAnchorRef = useRef<number | null>(null);

  const beginGesture = useCallback((args: BeginGestureArgs) => {
    const lines = useProjectStore.getState().lines;
    const projectSnapPoints = useProjectStore.getState().customSnapPoints;
    const audio = useAudioStore.getState();
    const settings = useSettingsStore.getState();
    const timeline = useTimelineStore.getState();
    const playhead = audio.audioElement?.currentTime ?? audio.currentTime ?? null;
    const vocalOnsets = settings.vocalOnsetSnap ? timeline.vocalOnsetSnapPoints : [];
    ctxRef.current.anchors = collectSnapAnchors(
      lines,
      args.selfIds,
      playhead,
      vocalOnsets,
      settings.timelineSnap,
      snapPointTimes(projectSnapPoints),
    );
    ctxRef.current.selfIds = args.selfIds;
    ctxRef.current.leaderKey = args.leaderKey;
    ctxRef.current.overlapCheck = args.overlapCheck;
  }, []);

  const endGesture = useCallback(() => {
    ctxRef.current.anchors = [];
    ctxRef.current.selfIds = new Set();
    ctxRef.current.leaderKey = "";
    ctxRef.current.overlapCheck = null;
    pendingDragAnchorRef.current = null;
    writeSnappedLeader("", null);
  }, []);

  const resolveSnap = useCallback((proposedDeltaPx: number, edgesAtStart: number[]): SnapResolution => {
    const ctx = ctxRef.current;
    const settings = useSettingsStore.getState();
    const timeline = useTimelineStore.getState();
    const enabled =
      settings.timelineSnap ||
      (settings.vocalOnsetSnap && timeline.vocalOnsetSnapPoints.length > 0) ||
      useProjectStore.getState().customSnapPoints.length > 0;
    const threshold = useSettingsStore.getState().timelineSnapThreshold;
    const bypassing = useTimelineStore.getState().isBypassing;
    const zoom = timeline.zoom;
    if (!enabled || bypassing || ctx.anchors.length === 0) return { shiftPx: 0, anchorTime: null };
    const deltaT = proposedDeltaPx / zoom;
    const proposedEdges = edgesAtStart.map((edge) => edge + deltaT);
    const overlapCheck = ctx.overlapCheck;
    const result = findSnapShift({
      edges: proposedEdges,
      anchors: ctx.anchors,
      zoom,
      threshold,
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

  const dragSnapModifier = useMemo<Modifier>(
    () =>
      ({ transform, active }) => {
        const data = active?.data.current as { snap?: { edgesAtStart: number[] } } | undefined;
        if (!data?.snap) return transform;
        const { shiftPx, anchorTime } = resolveSnap(transform.x, data.snap.edgesAtStart);
        pendingDragAnchorRef.current = anchorTime;
        if (shiftPx === 0) return transform;
        return { ...transform, x: transform.x + shiftPx };
      },
    [resolveSnap],
  );

  return { dragSnapModifier, beginGesture, endGesture, computeShiftPx, syncDragSnap };
}

// -- Exports ------------------------------------------------------------------

export { useTimelineSnap };
