import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { DRAG_THRESHOLD_PX } from "@/views/timeline/drag-threshold";
import { selfKey } from "@/views/timeline/snap";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useGestureInputReplay } from "@/views/timeline/use-gesture-input-replay";
import { useTimelineSnap } from "@/views/timeline/use-timeline-snap";
import { getWordsInInstance } from "@/views/timeline/utils";
import { useCallback, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface UseBannerDragArgs {
  groupId: string;
  instanceIdx: number;
  instanceStart: number;
  instanceEnd: number;
  zoom: number;
}

interface DragState {
  startX: number;
  moved: boolean;
  cleanup: () => void;
}

// -- Hook ----------------------------------------------------------------------

function useBannerDrag({ groupId, instanceIdx, instanceStart, instanceEnd, zoom }: UseBannerDragArgs) {
  const setDraggedGroupShift = useTimelineStore((s) => s.setDraggedGroupShift);
  const setSelectedWords = useTimelineStore((s) => s.setSelectedWords);
  const { beginGesture, computeShiftPx, endGesture } = useTimelineSnap();

  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const lastPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const getLastPointer = useCallback(() => lastPointerRef.current, []);
  useGestureInputReplay({ active: isDragging, getLastPointer });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const startX = e.clientX;
      const instanceWords = getWordsInInstance(useProjectStore.getState().lines, groupId, instanceIdx);
      const edgesAtStart = [instanceStart, instanceEnd];
      const snappedDx = (dx: number) => dx + computeShiftPx(dx, edgesAtStart);
      beginGesture({
        selfIds: new Set(instanceWords.map((word) => selfKey(word.lineId, word.wordIndex, word.type))),
        leaderKey: `banner:${groupId}:${instanceIdx}`,
        overlapCheck: () => true,
      });

      const handleMove = (moveEvent: PointerEvent) => {
        const dragState = dragStateRef.current;
        if (!dragState) return;
        lastPointerRef.current = { clientX: moveEvent.clientX, clientY: moveEvent.clientY };
        const dx = moveEvent.clientX - startX;
        if (!dragState.moved && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
          dragState.moved = true;
          setIsDragging(true);
        }
        if (dragState.moved) {
          const offsetPx = snappedDx(dx);
          setDragOffsetPx(offsetPx);
          setDraggedGroupShift({ groupId, instanceIdx, offsetPx });
        }
      };

      const handleUp = (upEvent: PointerEvent) => {
        const wasDrag = dragStateRef.current?.moved ?? false;
        const offsetPx = wasDrag ? snappedDx(upEvent.clientX - startX) : 0;
        dragStateRef.current?.cleanup();
        dragStateRef.current = null;
        lastPointerRef.current = null;
        endGesture();
        setIsDragging(false);
        setDragOffsetPx(0);
        setDraggedGroupShift(null);

        if (wasDrag && useProjectStore.getState().groups.find((g) => g.id === groupId)) {
          const deltaSeconds = offsetPx / zoom;
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
      };

      dragStateRef.current = { startX, moved: false, cleanup };
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [
      groupId,
      instanceIdx,
      instanceStart,
      instanceEnd,
      zoom,
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
