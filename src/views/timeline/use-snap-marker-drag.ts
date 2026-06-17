import { useCallback, useRef, useState } from "react";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { snapTimeToOnset } from "@/views/timeline/snap-marker-math";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { xToTime } from "@/views/timeline/coords";

// -- Types ---------------------------------------------------------------------

interface SnapMarkerDragConfig {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

interface SnapMarkerDrag {
  draggingId: string | null;
  draggingTime: number | null;
  onHeadPointerDown: (id: string, event: React.PointerEvent<HTMLElement>) => void;
}

// -- Hook ----------------------------------------------------------------------

function useSnapMarkerDrag({ scrollContainerRef }: SnapMarkerDragConfig): SnapMarkerDrag {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingTime, setDraggingTime] = useState<number | null>(null);
  const lastWrittenRef = useRef<number>(0);

  const onHeadPointerDown = useCallback(
    (id: string, event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const head = event.currentTarget;
      head.setPointerCapture(event.pointerId);

      const startPoints = useProjectStore.getState().customSnapPoints;
      const startPoint = startPoints.find((point) => point.id === id);
      lastWrittenRef.current = startPoint?.time ?? 0;
      setDraggingId(id);
      setDraggingTime(lastWrittenRef.current);

      const computeTime = (clientX: number): number => {
        const container = scrollContainerRef.current;
        if (!container) return lastWrittenRef.current;
        const { zoom, scrollLeft: storeScrollLeft } = useTimelineStore.getState();
        const scrollLeft = container.scrollLeft ?? storeScrollLeft;
        const rect = container.getBoundingClientRect();
        const raw = xToTime(clientX, rect, zoom, scrollLeft);
        const onsets = useSettingsStore.getState().vocalOnsetSnap
          ? useTimelineStore.getState().vocalOnsetSnapPoints
          : [];
        const thresholdPx = useSettingsStore.getState().timelineSnapThreshold;
        return snapTimeToOnset(raw, onsets, zoom, thresholdPx);
      };

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        const store = useProjectStore.getState();
        if (!store.customSnapPoints.some((point) => point.id === id)) return;
        const time = computeTime(moveEvent.clientX);
        lastWrittenRef.current = time;
        store.moveCustomSnapPoint(id, time);
        setDraggingTime(time);
      };

      const handlePointerUp = (): void => {
        head.removeEventListener("pointermove", handlePointerMove);
        head.removeEventListener("pointerup", handlePointerUp);
        head.removeEventListener("pointercancel", handlePointerUp);
        if (head.hasPointerCapture(event.pointerId)) head.releasePointerCapture(event.pointerId);
        useProjectStore.getState().commitSnapPointDrag(startPoints);
        setDraggingId(null);
        setDraggingTime(null);
      };

      head.addEventListener("pointermove", handlePointerMove);
      head.addEventListener("pointerup", handlePointerUp);
      head.addEventListener("pointercancel", handlePointerUp);
    },
    [scrollContainerRef],
  );

  return { draggingId, draggingTime, onHeadPointerDown };
}

// -- Exports -------------------------------------------------------------------

export { useSnapMarkerDrag };
export type { SnapMarkerDrag };
