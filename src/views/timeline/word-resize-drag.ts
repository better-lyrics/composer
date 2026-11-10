import { type BoundaryEdge, clampBoundaryTime, shouldRollNeighbour } from "@/domain/word/boundary";
import { boundsOverlap } from "@/domain/word/overlap";
import type { SyllablePosition } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { noteGuideSignal } from "@/lib/guide-signals";
import { swallowTrailingClick } from "@/lib/swallow-trailing-click";
import { useSettingsStore } from "@/stores/settings";
import { beginBoundaryDrag, endBoundaryDrag } from "@/views/timeline/boundary-chip-store";
import { DRAG_THRESHOLD_PX } from "@/views/timeline/drag-threshold";
import { settleLoupe, showLoupeEdit } from "@/views/timeline/loupe/loupe-target";
import { setLiveWordEdit } from "@/views/timeline/pitch/live-word-edit";
import { pointerTravelSeconds } from "@/views/timeline/pointer-travel";
import { resizeGestureSelfIds } from "@/views/timeline/resize-self-ids";
import { selfKey } from "@/views/timeline/snap";
import { storedLineTimeRange } from "@/views/timeline/stored-line-range";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { noteWordDragShift } from "@/views/timeline/tiny-drag-signal";
import { useGestureInputReplay } from "@/views/timeline/use-gesture-input-replay";
import { useSelectionStretchDrag } from "@/views/timeline/use-selection-stretch";
import { useTimelineSnap } from "@/views/timeline/use-timeline-snap";
import { type DragState, displayedBounds, liveWordBounds, resizeChangedTiming } from "@/views/timeline/word-resize-state";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

type UpdateWord = (
  index: number,
  updates: Partial<WordTiming>,
  adjacentIndex?: number,
  adjacentUpdates?: Partial<WordTiming>,
) => void;

interface WordResizeDragInput {
  lineId: string;
  trackType: "word" | "bg";
  words: WordTiming[];
  duration: number;
  syllablePositions: SyllablePosition[];
  onUpdateWord: UpdateWord;
}

// -- Constants -----------------------------------------------------------------

const STRETCH_DRAG_OPTIONS = {
  onDragEnd: (dragged: boolean) => {
    if (dragged) swallowTrailingClick();
  },
};

// -- Hook ----------------------------------------------------------------------

function useWordResizeDrag({
  lineId,
  trackType,
  words,
  duration,
  syllablePositions,
  onUpdateWord,
}: WordResizeDragInput) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  // react-doctor-disable-next-line react-doctor/rerender-state-only-in-handlers
  const [resizing, setResizing] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const draggedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const conjoinedRef = useRef<{ active: boolean; adjacentWordIndex: number | null }>({
    active: false,
    adjacentWordIndex: null,
  });

  const { beginGesture, computeShiftPx, endGesture } = useTimelineSnap();
  const getLastPointer = useCallback(() => lastPointerRef.current, []);
  useGestureInputReplay({ active: resizing, getLastPointer });

  // Dragging a multi-block selection's boundary edge stretches it instead of resizing one block.
  // Destructure the stable callback: the hook returns a fresh object every render.
  const { tryStart: tryStartStretch } = useSelectionStretchDrag(STRETCH_DRAG_OPTIONS);

  // react-doctor-disable-next-line react-doctor/exhaustive-deps
  useEffect(() => () => cleanupRef.current?.(), []);

  const handleResizeStart = useCallback(
    (edge: "left" | "right", startX: number, wordIndex: number) => {
      const track = trackRef.current;
      if (!track) return;
      if (tryStartStretch({ lineId, type: trackType, wordIndex, edge, startX, track })) return;
      const word = words[wordIndex];
      const initialState: DragState = { wordIndex, edge, begin: word.begin, end: word.end };
      dragStateRef.current = initialState;
      setDragState(initialState);

      const syllablesFollowRollingAtStart = useSettingsStore.getState().syllablesFollowRolling;
      const minWordDuration = useSettingsStore.getState().minWordDuration;
      const boundaryEdge: BoundaryEdge = edge === "left" ? "begin" : "end";
      const range = storedLineTimeRange(lineId, duration);

      const edgeKey = `${lineId}:${trackType}:${edge === "left" ? wordIndex - 1 : wordIndex}`;
      const teachesAltGap = shouldRollNeighbour({
        words,
        wordIndex,
        edge: boundaryEdge,
        rollingEdit: useSettingsStore.getState().rollingEdit,
        syllablesFollowRolling: syllablesFollowRollingAtStart,
        syllablePositions,
        altHeld: false,
      });
      if (teachesAltGap) beginBoundaryDrag(track, startX, edgeKey);

      setResizing(true);
      lastPointerRef.current = { clientX: startX, clientY: 0 };
      conjoinedRef.current = { active: false, adjacentWordIndex: null };
      draggedRef.current = false;
      beginGesture({
        selfIds: resizeGestureSelfIds(lineId, wordIndex, edge, words.length, trackType),
        leaderKey: selfKey(lineId, wordIndex, trackType),
        overlapCheck: (shift) => {
          const w = words[wordIndex];
          const newBegin = edge === "left" ? w.begin + shift : w.begin;
          const newEnd = edge === "right" ? w.end + shift : w.end;
          const adj = conjoinedRef.current.adjacentWordIndex;
          return !words.some((other, i) => {
            if (i === wordIndex) return false;
            if (conjoinedRef.current.active && i === adj) return false;
            return boundsOverlap({ begin: newBegin, end: newEnd }, other);
          });
        },
      });

      const travelSeconds = pointerTravelSeconds(track, startX);

      const handleMouseMove = (e: PointerEvent) => {
        const zoom = useTimelineStore.getState().zoom;
        const rawDeltaPx = travelSeconds(e.clientX) * zoom;
        if (Math.abs(rawDeltaPx) >= DRAG_THRESHOLD_PX) draggedRef.current = true;
        lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
        if (!draggedRef.current) return;
        const originalWord = words[wordIndex];
        const conjoined = shouldRollNeighbour({
          words,
          wordIndex,
          edge: boundaryEdge,
          rollingEdit: useSettingsStore.getState().rollingEdit,
          syllablesFollowRolling: syllablesFollowRollingAtStart,
          syllablePositions,
          altHeld: e.altKey,
        });

        const adjacentWordIndex = conjoined ? (edge === "left" ? wordIndex - 1 : wordIndex + 1) : null;
        conjoinedRef.current = { active: adjacentWordIndex !== null, adjacentWordIndex };

        const edgeAtStart = edge === "left" ? originalWord.begin : originalWord.end;
        const snapShiftPx = computeShiftPx(rawDeltaPx, [edgeAtStart]);
        const clamped = clampBoundaryTime({
          words,
          wordIndex,
          edge: boundaryEdge,
          time: edgeAtStart + (rawDeltaPx + snapShiftPx) / zoom,
          minDuration: minWordDuration,
          rollNeighbour: adjacentWordIndex !== null,
          range,
        });

        const adjacent =
          adjacentWordIndex === null
            ? null
            : {
                adjacentWordIndex,
                adjacentBegin: edge === "left" ? words[adjacentWordIndex].begin : clamped,
                adjacentEnd: edge === "left" ? clamped : words[adjacentWordIndex].end,
              };
        const newState: DragState =
          edge === "left"
            ? { wordIndex, edge, begin: clamped, end: originalWord.end, ...adjacent }
            : { wordIndex, edge, begin: originalWord.begin, end: clamped, ...adjacent };

        dragStateRef.current = newState;
        setDragState(newState);
        setLiveWordEdit({ lineId, kind: trackType, words: liveWordBounds(newState) });
        showLoupeEdit(
          { lineId, track: trackType, wordIndex, edge: boundaryEdge, startTime: edgeAtStart, time: clamped },
          false,
        );
      };

      const handleMouseUp = () => {
        setResizing(false);
        endGesture();

        const finalState = dragStateRef.current;
        const dragged = draggedRef.current;
        dragStateRef.current = null;
        setDragState(null);
        setLiveWordEdit(null);

        if (dragged) {
          swallowTrailingClick();
          settleLoupe();
        }
        const changedTiming = dragged && finalState !== null && resizeChangedTiming(initialState, finalState, words);
        if (teachesAltGap) {
          endBoundaryDrag(changedTiming ? { edgeKey, gapOpen: finalState?.adjacentWordIndex === undefined } : null);
        }

        if (changedTiming && finalState) {
          noteGuideSignal("timeline.resize");
          if (finalState.adjacentWordIndex !== undefined && useSettingsStore.getState().rollingEdit)
            noteGuideSignal("timeline.rolling");
          const edgeShift = edge === "left" ? finalState.begin - initialState.begin : finalState.end - initialState.end;
          noteWordDragShift(lineId, trackType, wordIndex, edgeShift);
          if (finalState.adjacentWordIndex !== undefined) {
            const mainUpdate = edge === "left" ? { begin: finalState.begin } : { end: finalState.end };
            const adjUpdate = edge === "left" ? { end: finalState.adjacentEnd! } : { begin: finalState.adjacentBegin! };
            onUpdateWord(wordIndex, mainUpdate, finalState.adjacentWordIndex, adjUpdate);
          } else if (edge === "left") {
            onUpdateWord(wordIndex, { begin: finalState.begin });
          } else {
            onUpdateWord(wordIndex, { end: finalState.end });
          }
        }

        cleanupRef.current = null;
        document.removeEventListener("pointermove", handleMouseMove);
        document.removeEventListener("pointerup", handleMouseUp);
      };

      cleanupRef.current = () => {
        endBoundaryDrag(null);
        setResizing(false);
        setLiveWordEdit(null);
        endGesture();
        settleLoupe();
        document.removeEventListener("pointermove", handleMouseMove);
        document.removeEventListener("pointerup", handleMouseUp);
      };

      document.addEventListener("pointermove", handleMouseMove);
      document.addEventListener("pointerup", handleMouseUp);
    },
    [
      words,
      duration,
      onUpdateWord,
      syllablePositions,
      beginGesture,
      computeShiftPx,
      endGesture,
      lineId,
      trackType,
      tryStartStretch,
    ],
  );

  const displays = useMemo(
    () => words.map((_, wordIndex) => displayedBounds(words, wordIndex, dragState)),
    [words, dragState],
  );

  return { trackRef, displays, handleResizeStart };
}

// -- Exports -------------------------------------------------------------------

export { useWordResizeDrag };
export type { UpdateWord };
