import { wholeSongRange } from "@/domain/group/shared-timing";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { DRAG_THRESHOLD_PX } from "@/views/timeline/drag-threshold";
import { pointerTravelSeconds } from "@/views/timeline/pointer-travel";
import { selfKey } from "@/views/timeline/snap";
import { holdsSnapBypass } from "@/views/timeline/snap-bypass-key";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { type LastPointer, useGestureInputReplay } from "@/views/timeline/use-gesture-input-replay";
import { useTimelineSnap } from "@/views/timeline/use-timeline-snap";
import { getWordsInInstance } from "@/views/timeline/utils";
import { useCallback, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface UseBannerDragArgs {
  groupId: string;
  instanceIdx: number;
  instanceStart: number;
  instanceEnd: number;
}

interface DragState {
  startX: number;
  moved: boolean;
  cleanup: () => void;
}

// -- Constants -----------------------------------------------------------------

const SONG_EDGE_EPSILON = 1e-6;

// -- Helpers -------------------------------------------------------------------

function syncSnapBypass(event: { metaKey: boolean; ctrlKey: boolean }): void {
  const held = holdsSnapBypass(event);
  if (useTimelineStore.getState().isBypassing !== held) useTimelineStore.getState().setIsBypassing(held);
}

// -- Hook ----------------------------------------------------------------------

function useBannerDrag({ groupId, instanceIdx, instanceStart, instanceEnd }: UseBannerDragArgs) {
  const setDraggedGroupShift = useTimelineStore((s) => s.setDraggedGroupShift);
  const setSelectedWords = useTimelineStore((s) => s.setSelectedWords);
  const { beginGesture, computeShiftPx, endGesture } = useTimelineSnap();

  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const lastPointerRef = useRef<LastPointer | null>(null);
  const getLastPointer = useCallback(() => lastPointerRef.current, []);
  useGestureInputReplay({ active: isDragging, getLastPointer });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const row = e.currentTarget.parentElement;
      if (!row) return;
      const startX = e.clientX;
      const travelSeconds = pointerTravelSeconds(row, startX);
      const travelPx = (clientX: number) => travelSeconds(clientX) * useTimelineStore.getState().zoom;
      const instanceWords = getWordsInInstance(useProjectStore.getState().lines, groupId, instanceIdx);
      const edgesAtStart = [instanceStart, instanceEnd];
      const songRange = wholeSongRange(useAudioStore.getState().duration);
      let proposedDeltaSeconds = 0;
      const snappedDx = (dx: number, event: PointerEvent) => {
        syncSnapBypass(event);
        proposedDeltaSeconds = dx / useTimelineStore.getState().zoom;
        return dx + computeShiftPx(dx, edgesAtStart);
      };
      syncSnapBypass(e);
      beginGesture({
        selfIds: new Set(instanceWords.map((word) => selfKey(word.lineId, word.wordIndex, word.type))),
        leaderKey: `banner:${groupId}:${instanceIdx}`,
        overlapCheck: (shift) =>
          instanceStart + proposedDeltaSeconds + shift >= songRange.min - SONG_EDGE_EPSILON &&
          instanceEnd + proposedDeltaSeconds + shift <= songRange.max + SONG_EDGE_EPSILON,
      });

      const handleMove = (moveEvent: PointerEvent) => {
        const dragState = dragStateRef.current;
        if (!dragState) return;
        lastPointerRef.current = {
          clientX: moveEvent.clientX,
          clientY: moveEvent.clientY,
          altKey: moveEvent.altKey,
          shiftKey: moveEvent.shiftKey,
          metaKey: moveEvent.metaKey,
          ctrlKey: moveEvent.ctrlKey,
        };
        const dx = travelPx(moveEvent.clientX);
        if (!dragState.moved && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
          dragState.moved = true;
          setIsDragging(true);
        }
        if (dragState.moved) {
          const offsetPx = snappedDx(dx, moveEvent);
          setDragOffsetPx(offsetPx);
          setDraggedGroupShift({ groupId, instanceIdx, offsetPx });
        }
      };

      const finishDrag = () => {
        dragStateRef.current?.cleanup();
        dragStateRef.current = null;
        lastPointerRef.current = null;
        endGesture();
        useTimelineStore.getState().setIsBypassing(false);
        setIsDragging(false);
        setDragOffsetPx(0);
        setDraggedGroupShift(null);
      };

      const handleUp = (upEvent: PointerEvent) => {
        const wasDrag = dragStateRef.current?.moved ?? false;
        const offsetPx = wasDrag ? snappedDx(travelPx(upEvent.clientX), upEvent) : 0;
        finishDrag();

        if (wasDrag && useProjectStore.getState().groups.find((g) => g.id === groupId)) {
          const deltaSeconds = offsetPx / useTimelineStore.getState().zoom;
          if (Math.abs(deltaSeconds) > 0.001) {
            useProjectStore
              .getState()
              .shiftInstance(groupId, instanceIdx, deltaSeconds, useAudioStore.getState().duration);
          }
        } else {
          // treat as click: select all words in this instance (so nudge works on it)
          setSelectedWords(instanceWords);
        }
      };

      const cleanup = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        document.removeEventListener("pointercancel", finishDrag);
      };

      dragStateRef.current = { startX, moved: false, cleanup };
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
      document.addEventListener("pointercancel", finishDrag);
    },
    [
      groupId,
      instanceIdx,
      instanceStart,
      instanceEnd,
      beginGesture,
      computeShiftPx,
      endGesture,
      setSelectedWords,
      setDraggedGroupShift,
    ],
  );

  return { dragOffsetPx, isDragging, handlePointerDown };
}

// -- Exports -------------------------------------------------------------------

export { useBannerDrag };
