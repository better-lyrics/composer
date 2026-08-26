import { type LyricLine, reconcileLine } from "@/domain/line/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { DRAG_THRESHOLD_PX } from "@/views/timeline/drag-threshold";
import { selfKey } from "@/views/timeline/snap";
import { planStretchDrag } from "@/views/timeline/stretch-drag";
import { mapStretchTargets, stretchSelections } from "@/views/timeline/stretch-selection";
import { STRETCH_EPS } from "@/views/timeline/stretch-targets";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useSnapBypass } from "@/views/timeline/use-snap-bypass";
import { useTimelineSnap } from "@/views/timeline/use-timeline-snap";
import { useCallback, useEffect, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface StretchDragArgs {
  lineId: string;
  type: "word" | "bg";
  wordIndex: number;
  edge: "left" | "right";
  startX: number;
}

interface UseSelectionStretchOptions {
  // Mirrors word-track's justResized guard: invoked with dragged=true when a
  // stretch gesture moved past the drag threshold, so the trailing click does
  // not rewrite the selection.
  onDragEnd?: (dragged: boolean) => void;
}

interface UseSelectionStretchDrag {
  isStretching: boolean;
  // Returns true when the drag was claimed as a proportional stretch; the
  // caller must then skip its plain resize path.
  tryStart: (args: StretchDragArgs) => boolean;
}

// -- Constants -----------------------------------------------------------------

// Commit only when the factor moved meaningfully away from 1; mirrors the
// single-word resize's "did the timing actually change" guard.
const COMMIT_FACTOR_EPS = 1e-3;

// -- Helpers -------------------------------------------------------------------

// Preview writes go through setTransientLines: transient states that must not
// mark the project dirty. The committed result goes through
// updateLinesWithHistory, which owns history and dirty flags. The action keeps
// the array reference, which the drag relies on for its external-writer check.
function writePreviewLines(lines: LyricLine[]): void {
  useProjectStore.getState().setTransientLines(lines);
}

// Applies stretch updates to the pre-drag snapshot, mirroring how
// updateLinesWithHistory reconciles each line (no sibling propagation — the
// commit opts out of it too).
function applyStretchUpdates(
  snapshotLines: LyricLine[],
  updates: ReadonlyArray<{ id: string; updates: Partial<LyricLine> }>,
): LyricLine[] {
  const updatesById = new Map(updates.map((u) => [u.id, u.updates]));
  return snapshotLines.map((line) => {
    const lineUpdates = updatesById.get(line.id);
    return lineUpdates ? reconcileLine({ ...line, ...lineUpdates }) : line;
  });
}

// -- Hook ----------------------------------------------------------------------

// Proportional stretch of a multi-block selection, driven by dragging the
// selection's boundary edge on a word block: right edge → anchored at the
// selection's start, left edge → anchored at its end. Everything the drag
// needs is captured from store snapshots at pointerdown, so listeners never
// see stale component state.
function useSelectionStretchDrag({ onDragEnd }: UseSelectionStretchOptions = {}): UseSelectionStretchDrag {
  const [isStretching, setIsStretching] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const onDragEndRef = useRef(onDragEnd);

  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  const snap = useTimelineSnap();
  const { beginGesture, computeShiftPx, endGesture } = snap;
  const getLastPointer = useCallback(() => lastPointerRef.current, []);
  useSnapBypass({ active: isStretching, getLastPointer });

  // A drag cut short by unmount (undo rewrote lines, project cleared, tab
  // switched) must restore the snapshotted lines — otherwise the transient
  // preview would be stranded in the store with no history entry to undo it.
  // Depend on endGesture (a stable useCallback), NOT the snap object —
  // useTimelineSnap returns a fresh object every render, so an object dep
  // would re-run this cleanup on every preview frame and tear down the gesture.
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      endGesture();
    };
  }, [endGesture]);

  const tryStart = useCallback(
    ({ lineId, type, wordIndex, edge, startX }: StretchDragArgs): boolean => {
      // A second pointerdown before the first gesture finished (multi-touch,
      // stuck pointer) tears the first gesture down first, so the snapshot below
      // captures committed state, not the prior gesture's transient preview.
      cleanupRef.current?.();
      cleanupRef.current = null;

      const snapshotLines = useProjectStore.getState().lines;
      const selection = useTimelineStore.getState().selectedWords;
      const options = {
        duration: useAudioStore.getState().duration,
        minWordDuration: useSettingsStore.getState().minWordDuration,
      };
      const plan = planStretchDrag(snapshotLines, selection, { lineId, type, wordIndex, edge }, options);
      if (!plan) return false;

      const zoom = useTimelineStore.getState().zoom;
      const { anchor, anchorTime, edgeTime, minFactor, maxFactor, targets } = plan;
      const selfIds = new Set(selection.map((s) => selfKey(s.lineId, s.wordIndex, s.type)));

      // Factor of distances from the anchor implied by a dragged-edge time.
      const factorForEdgeTime = (t: number) =>
        anchorTime < edgeTime ? (t - anchorTime) / (edgeTime - anchorTime) : (anchorTime - t) / (anchorTime - edgeTime);

      setIsStretching(true);
      lastPointerRef.current = { clientX: startX, clientY: 0 };

      beginGesture({
        selfIds,
        // Synthetic key: matches no word block, so snap highlights never light
        // up a block that is not actually being dragged.
        leaderKey: `stretch:${anchorTime}:${edgeTime}`,
        overlapCheck: (shiftSec) => {
          const k = factorForEdgeTime(edgeTime + shiftSec);
          return k >= minFactor - STRETCH_EPS && k <= maxFactor + STRETCH_EPS;
        },
      });

      let dragged = false;
      // Escape finishes with commit=false, but the pending pointerup listener
      // would then run finish(true) again — guard so a discarded drag can never
      // be committed by the trailing pointerup.
      let finished = false;
      let currentFactor = 1;
      // Array reference of the last preview write (null before the first one).
      // Used to detect external writers (undo, import, project clear) that
      // replaced lines mid-drag.
      let lastWritten: LyricLine[] | null = null;

      function preview(k: number): void {
        // An external writer (undo, import, project clear) replaced lines since
        // our last preview: abandon so continued dragging never clobbers it.
        if (lastWritten !== null && useProjectStore.getState().lines !== lastWritten) {
          finish(false);
          return;
        }
        const updates = mapStretchTargets(targets, k, anchorTime);
        lastWritten = applyStretchUpdates(snapshotLines, updates);
        writePreviewLines(lastWritten);
      }

      function handleMove(ev: PointerEvent): void {
        lastPointerRef.current = { clientX: ev.clientX, clientY: ev.clientY };
        if (Math.abs(ev.clientX - startX) >= DRAG_THRESHOLD_PX) dragged = true;
        if (!dragged) return;
        const rawDeltaPx = ev.clientX - startX;
        const snapShiftPx = computeShiftPx(rawDeltaPx, [edgeTime]);
        const proposedEdge = edgeTime + (rawDeltaPx + snapShiftPx) / zoom;
        const k = Math.min(Math.max(factorForEdgeTime(proposedEdge), minFactor), maxFactor);
        if (k === currentFactor) return;
        currentFactor = k;
        preview(k);
      }

      function handleUp(): void {
        finish(true);
      }

      function handleCancel(): void {
        finish(false);
      }

      function handleKey(ev: KeyboardEvent): void {
        if (ev.key === "Escape") finish(false);
      }

      function teardown(): void {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        document.removeEventListener("pointercancel", handleCancel);
        document.removeEventListener("keydown", handleKey);
        cleanupRef.current = null;
      }

      function finish(commit: boolean): void {
        if (finished) return;
        finished = true;
        setIsStretching(false);
        endGesture();
        // If an external writer (Ctrl+Z mid-drag, import, project clear)
        // replaced lines since our last preview, restoring the snapshot would
        // swallow their change — abandon the gesture and keep their state.
        const stillOurs = useProjectStore.getState().lines === (lastWritten ?? snapshotLines);
        if (stillOurs) {
          // Restore the snapshot first so the history entry below captures the
          // true pre-drag state (and a discarded drag leaves no trace at all).
          writePreviewLines(snapshotLines);
        }
        teardown();
        if (stillOurs && commit && dragged && Math.abs(currentFactor - 1) >= COMMIT_FACTOR_EPS) {
          const result = stretchSelections(snapshotLines, selection, currentFactor, { ...options, anchor });
          if (result.updates.length > 0) {
            useProjectStore.getState().updateLinesWithHistory(result.updates, { propagateToSiblings: false });
          }
        }
        onDragEndRef.current?.(dragged);
      }

      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
      document.addEventListener("pointercancel", handleCancel);
      document.addEventListener("keydown", handleKey);
      // The unmount path shares the discarded-drag path: restore and release.
      cleanupRef.current = () => finish(false);
      return true;
    },
    [beginGesture, computeShiftPx, endGesture],
  );

  return { isStretching, tryStart };
}

// -- Exports -------------------------------------------------------------------

export { useSelectionStretchDrag };
