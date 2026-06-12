import type { LyricLine } from "@/domain/line/model";
import type { WordSelection } from "@/domain/selection/model";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { resolveDropTarget } from "@/views/timeline/drag-end-resolution";
import {
  applyCrossLineMove,
  applySameLineReorder,
  DRAG_X_MIN_THRESHOLD,
  expandSelectionsAcrossLines,
  handleAltDuplicate,
  resolveWordsToOperate,
  type DragData,
} from "@/views/timeline/drag-handlers";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useCallback, useEffect, useRef, useState } from "react";

// -- Hook ----------------------------------------------------------------------

function useTimelineDnd(lines: LyricLine[]) {
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
  const moveWordToBg = useProjectStore((s) => s.moveWordToBg);
  const moveWordFromBg = useProjectStore((s) => s.moveWordFromBg);
  const duration = useAudioStore((s) => s.duration);
  const zoom = useTimelineStore((s) => s.zoom);

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const dragShiftRef = useRef(false);
  const shiftListenersCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => shiftListenersCleanupRef.current?.();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (!data) return;

    const initialShiftKey = event.activatorEvent instanceof PointerEvent ? event.activatorEvent.shiftKey : false;
    setActiveDrag({ ...data, initialShiftKey });
    document.body.style.cursor = "grabbing";

    shiftListenersCleanupRef.current?.();
    dragShiftRef.current = initialShiftKey;
    const onPointer = (e: PointerEvent) => {
      dragShiftRef.current = e.shiftKey;
    };
    const onKey = (e: KeyboardEvent) => {
      dragShiftRef.current = e.shiftKey;
    };
    window.addEventListener("pointermove", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);
    shiftListenersCleanupRef.current = () => {
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    };
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      document.body.style.cursor = "";

      const isShiftDrag = dragShiftRef.current;
      shiftListenersCleanupRef.current?.();
      shiftListenersCleanupRef.current = null;
      dragShiftRef.current = false;

      const { active, delta, activatorEvent } = event;
      const isAltDrag = activatorEvent instanceof PointerEvent && activatorEvent.altKey;

      const activeData = active.data.current as DragData | undefined;
      if (!activeData) return;

      if (isAltDrag) {
        handleAltDuplicate(event, lines, zoom, duration);
        return;
      }

      const target = resolveDropTarget(event, lines);
      if (!target) return;

      const targetLine = lines[target.targetLineIndex];
      if (!targetLine) return;

      const { selectedWords } = useTimelineStore.getState();
      const draggedOnly: WordSelection[] = [
        {
          lineId: activeData.lineId,
          lineIndex: activeData.lineIndex,
          wordIndex: activeData.wordIndex,
          type: activeData.trackType,
        },
      ];
      const wordsToMove = expandSelectionsAcrossLines(
        lines,
        isShiftDrag ? draggedOnly : resolveWordsToOperate(activeData, selectedWords),
      );
      const timeDelta = delta.x / zoom;

      const sameLine = targetLine.id === activeData.lineId;
      const sameTrack = target.targetTrack === activeData.trackType;

      if (sameLine && !sameTrack) {
        if (activeData.trackType === "word" && target.targetTrack === "bg") {
          const indices = wordsToMove.flatMap((s) =>
            s.lineId === activeData.lineId && s.type === "word" ? [s.wordIndex] : [],
          );
          moveWordToBg(activeData.lineId, indices, timeDelta, duration);
          return;
        }
        const indices = wordsToMove.flatMap((s) =>
          s.lineId === activeData.lineId && s.type === "bg" ? [s.wordIndex] : [],
        );
        moveWordFromBg(activeData.lineId, indices, timeDelta, duration);
        return;
      }

      if (sameLine && sameTrack) {
        if (Math.abs(delta.x) < DRAG_X_MIN_THRESHOLD) return;
        applySameLineReorder(activeData, wordsToMove, lines, timeDelta, duration, updateLineWithHistory);
        return;
      }

      applyCrossLineMove({
        activeData,
        targetLine,
        targetTrack: target.targetTrack,
        wordsToMove,
        lines,
        timeDelta,
        duration,
      });
    },
    [moveWordToBg, moveWordFromBg, updateLineWithHistory, zoom, duration, lines],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
    document.body.style.cursor = "";
    shiftListenersCleanupRef.current?.();
    shiftListenersCleanupRef.current = null;
    dragShiftRef.current = false;
  }, []);

  return { sensors, activeDrag, handleDragStart, handleDragEnd, handleDragCancel };
}

// -- Exports -------------------------------------------------------------------

export { useTimelineDnd };
