import type { ReadableLine } from "@/domain/line/effective-words";
import { noteGuideSignal } from "@/lib/guide-signals";
import { swallowTrailingClick } from "@/lib/swallow-trailing-click";
import { useAudioStore } from "@/stores/audio";
import { handleAltDuplicate } from "@/views/timeline/alt-duplicate";
import { hitTestTrack, resolveDropTarget } from "@/views/timeline/drag-end-resolution";
import {
  DRAG_X_MIN_THRESHOLD,
  type DragData,
  applyCrossLineMove,
  applySameLineReorder,
  draggedWord,
  expandSelectionsAcrossLines,
  resolveWordsToOperate,
} from "@/views/timeline/drag-handlers";
import { noteWordDragShift } from "@/views/timeline/tiny-drag-signal";
import { noteLoneWordMove } from "@/views/timeline/word-by-word-signal";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useCallback, useEffect, useRef, useState } from "react";

// -- Hook ----------------------------------------------------------------------

function useTimelineDnd(lines: ReadableLine[]) {
  const duration = useAudioStore((s) => s.duration);

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const dragShiftRef = useRef(false);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const dragListenersCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragListenersCleanupRef.current?.();
      useTimelineStore.getState().setWordDragHover(null);
    };
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

    dragListenersCleanupRef.current?.();
    dragShiftRef.current = initialShiftKey;
    if (event.activatorEvent instanceof PointerEvent) {
      pointerXRef.current = event.activatorEvent.clientX;
      pointerYRef.current = event.activatorEvent.clientY;
    }
    const onPointer = (e: PointerEvent) => {
      dragShiftRef.current = e.shiftKey;
      pointerXRef.current = e.clientX;
      pointerYRef.current = e.clientY;
      useTimelineStore.getState().setWordDragHover(hitTestTrack(e.clientX, e.clientY));
    };
    const onKey = (e: KeyboardEvent) => {
      dragShiftRef.current = e.shiftKey;
    };
    useTimelineStore.getState().setWordDragHover(hitTestTrack(pointerXRef.current, pointerYRef.current));
    window.addEventListener("pointermove", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);
    dragListenersCleanupRef.current = () => {
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
    };
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      swallowTrailingClick();
      setActiveDrag(null);
      useTimelineStore.getState().setWordDragHover(null);
      document.body.style.cursor = "";

      const isShiftDrag = dragShiftRef.current;
      const clientX = pointerXRef.current;
      const clientY = pointerYRef.current;
      dragListenersCleanupRef.current?.();
      dragListenersCleanupRef.current = null;
      dragShiftRef.current = false;

      const { active, delta, activatorEvent } = event;
      const isAltDrag = activatorEvent instanceof PointerEvent && activatorEvent.altKey;

      const activeData = active.data.current as DragData | undefined;
      if (!activeData) return;

      const { zoom } = useTimelineStore.getState();

      if (isAltDrag) {
        handleAltDuplicate(event, lines, zoom, duration);
        return;
      }

      const target = resolveDropTarget({ clientX, clientY, lines });
      if (!target) return;

      const targetLine = lines[target.targetLineIndex];
      if (!targetLine) return;

      const { selectedWords } = useTimelineStore.getState();
      const wordsToMove = expandSelectionsAcrossLines(
        lines,
        isShiftDrag ? [draggedWord(activeData)] : resolveWordsToOperate(lines, activeData, selectedWords),
      );
      const timeDelta = delta.x / zoom;

      const sameLine = targetLine.id === activeData.lineId;
      const sameTrack = target.targetTrack === activeData.trackType;

      if (sameLine && sameTrack) {
        if (Math.abs(delta.x) < DRAG_X_MIN_THRESHOLD) return;
        applySameLineReorder(wordsToMove, lines, timeDelta, duration);
        noteGuideSignal("timeline.move");
        noteWordDragShift(activeData.lineId, activeData.trackType, activeData.wordIndex, timeDelta);
        if (wordsToMove.length === 1) noteLoneWordMove(activeData.lineId, activeData.trackType, activeData.wordIndex);
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
      noteGuideSignal("timeline.move");
    },
    [duration, lines],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
    useTimelineStore.getState().setWordDragHover(null);
    document.body.style.cursor = "";
    dragListenersCleanupRef.current?.();
    dragListenersCleanupRef.current = null;
    dragShiftRef.current = false;
  }, []);

  return { sensors, activeDrag, handleDragStart, handleDragEnd, handleDragCancel };
}

// -- Exports -------------------------------------------------------------------

export { useTimelineDnd };
