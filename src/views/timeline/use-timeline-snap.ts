import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { collectSnapAnchors, findSnapShift, type SnapAnchor } from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { Modifier } from "@dnd-kit/core";
import { useCallback, useMemo, useRef } from "react";

// -- Constants ----------------------------------------------------------------

const SNAP_THRESHOLD_PX = 8;

// -- Module state -------------------------------------------------------------

let pulseCounter = 0;

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

interface UseTimelineSnap {
  dragSnapModifier: Modifier;
  beginGesture: (args: BeginGestureArgs) => void;
  endGesture: () => void;
  computeShiftPx: (proposedDeltaPx: number, edgesAtStart: number[]) => number;
}

// -- Helpers ------------------------------------------------------------------

function writeSnappedLeader(leaderKey: string, snapped: boolean): void {
  if (!snapped) {
    useTimelineStore.getState().setSnappedBlockId(null);
    return;
  }
  pulseCounter += 1;
  useTimelineStore.getState().setSnappedBlockId(`${leaderKey}#${pulseCounter}`);
}

// -- Hook ---------------------------------------------------------------------

function useTimelineSnap(): UseTimelineSnap {
  useSettingsStore((s) => s.timelineSnap);
  useTimelineStore((s) => s.zoom);
  useTimelineStore((s) => s.isBypassing);

  const ctxRef = useRef<SnapCtx>({
    anchors: [],
    selfIds: new Set(),
    leaderKey: "",
    overlapCheck: null,
  });

  const beginGesture = useCallback((args: BeginGestureArgs) => {
    const lines = useProjectStore.getState().lines;
    const audio = useAudioStore.getState();
    const playhead = audio.audioElement?.currentTime ?? audio.currentTime ?? null;
    ctxRef.current.anchors = collectSnapAnchors(lines, args.selfIds, playhead);
    ctxRef.current.selfIds = args.selfIds;
    ctxRef.current.leaderKey = args.leaderKey;
    ctxRef.current.overlapCheck = args.overlapCheck;
  }, []);

  const endGesture = useCallback(() => {
    ctxRef.current.anchors = [];
    ctxRef.current.selfIds = new Set();
    ctxRef.current.leaderKey = "";
    ctxRef.current.overlapCheck = null;
    useTimelineStore.getState().setSnappedBlockId(null);
  }, []);

  const computeShiftPx = useCallback((proposedDeltaPx: number, edgesAtStart: number[]): number => {
    const ctx = ctxRef.current;
    const enabled = useSettingsStore.getState().timelineSnap;
    const bypassing = useTimelineStore.getState().isBypassing;
    const zoom = useTimelineStore.getState().zoom;
    if (!enabled || bypassing || ctx.anchors.length === 0) {
      writeSnappedLeader(ctx.leaderKey, false);
      return 0;
    }
    const deltaT = proposedDeltaPx / zoom;
    const proposedEdges = edgesAtStart.map((edge) => edge + deltaT);
    const overlapCheck = ctx.overlapCheck;
    const result = findSnapShift({
      edges: proposedEdges,
      anchors: ctx.anchors,
      zoom,
      threshold: SNAP_THRESHOLD_PX,
      overlapCheck: overlapCheck ? (shift) => overlapCheck(shift) : undefined,
    });
    writeSnappedLeader(ctx.leaderKey, result.anchor !== null);
    return result.shift * zoom;
  }, []);

  const dragSnapModifier = useMemo<Modifier>(
    () =>
      ({ transform, active }) => {
        const data = active?.data.current as { snap?: { edgesAtStart: number[] } } | undefined;
        if (!data?.snap) return transform;
        const shiftPx = computeShiftPx(transform.x, data.snap.edgesAtStart);
        if (shiftPx === 0) return transform;
        return { ...transform, x: transform.x + shiftPx };
      },
    [computeShiftPx],
  );

  return { dragSnapModifier, beginGesture, endGesture, computeShiftPx };
}

// -- Exports ------------------------------------------------------------------

export { useTimelineSnap, SNAP_THRESHOLD_PX };
export type { BeginGestureArgs, UseTimelineSnap };
