import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { collectSnapAnchors, findSnapShift, type SnapAnchor } from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { Modifier } from "@dnd-kit/core";
import { useCallback, useMemo, useRef } from "react";

// -- Constants ----------------------------------------------------------------

const SNAP_THRESHOLD_PX = 8;

// -- Types --------------------------------------------------------------------

interface BeginGestureArgs {
  selfIds: Set<string>;
  overlapCheck: (shift: number) => boolean;
}

interface SnapCtx {
  enabled: boolean;
  bypassing: boolean;
  zoom: number;
  anchors: SnapAnchor[];
  selfIds: Set<string>;
  overlapCheck: ((shift: number) => boolean) | null;
}

interface UseTimelineSnap {
  dragSnapModifier: Modifier;
  beginGesture: (args: BeginGestureArgs) => void;
  endGesture: () => void;
  computeShiftPx: (proposedDeltaPx: number, edgesAtStart: number[]) => number;
}

// -- Helpers ------------------------------------------------------------------

function writeSnappedKey(anchor: SnapAnchor | null): void {
  const store = useTimelineStore.getState() as {
    setSnappedBlockId?: (key: string | null) => void;
  };
  if (!store.setSnappedBlockId) return;
  if (!anchor) {
    store.setSnappedBlockId(null);
    return;
  }
  const key = `${anchor.kind}:${anchor.lineId ?? ""}:${anchor.wordIndex ?? ""}:${anchor.t.toFixed(6)}`;
  store.setSnappedBlockId(key);
}

// -- Hook ---------------------------------------------------------------------

function useTimelineSnap(): UseTimelineSnap {
  const enabled = useSettingsStore((s) => s.timelineSnap);
  const zoom = useTimelineStore((s) => s.zoom);
  const isBypassing = useTimelineStore((s) => s.isBypassing);

  const ctxRef = useRef<SnapCtx>({
    enabled: true,
    bypassing: false,
    zoom: 100,
    anchors: [],
    selfIds: new Set(),
    overlapCheck: null,
  });

  ctxRef.current.enabled = enabled;
  ctxRef.current.bypassing = isBypassing;
  ctxRef.current.zoom = zoom;

  const beginGesture = useCallback((args: BeginGestureArgs) => {
    const lines = useProjectStore.getState().lines;
    const audio = useAudioStore.getState();
    const playhead = audio.audioElement?.currentTime ?? audio.currentTime ?? null;
    ctxRef.current.anchors = collectSnapAnchors(lines, args.selfIds, playhead);
    ctxRef.current.selfIds = args.selfIds;
    ctxRef.current.overlapCheck = args.overlapCheck;
  }, []);

  const endGesture = useCallback(() => {
    ctxRef.current.anchors = [];
    ctxRef.current.selfIds = new Set();
    ctxRef.current.overlapCheck = null;
    writeSnappedKey(null);
  }, []);

  const computeShiftPx = useCallback((proposedDeltaPx: number, edgesAtStart: number[]): number => {
    const ctx = ctxRef.current;
    if (!ctx.enabled || ctx.bypassing || ctx.anchors.length === 0) {
      writeSnappedKey(null);
      return 0;
    }
    const deltaT = proposedDeltaPx / ctx.zoom;
    const proposedEdges = edgesAtStart.map((edge) => edge + deltaT);
    const overlapCheck = ctx.overlapCheck;
    const result = findSnapShift({
      edges: proposedEdges,
      anchors: ctx.anchors,
      zoom: ctx.zoom,
      threshold: SNAP_THRESHOLD_PX,
      overlapCheck: overlapCheck ? (shift) => overlapCheck(shift) : undefined,
    });
    writeSnappedKey(result.anchor);
    return result.shift * ctx.zoom;
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
