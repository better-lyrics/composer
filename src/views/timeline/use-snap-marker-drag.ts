import { useCallback, useRef, useState } from "react";
import { useSettingsStore } from "@/stores/settings";
import { snapTimeToOnset } from "@/views/timeline/snap-marker-math";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { xToTime } from "@/views/timeline/coords";

// -- Types ---------------------------------------------------------------------

interface SnapMarkerDragConfig {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

interface SnapMarkerDrag {
  draggingTime: number | null;
  onHeadPointerDown: (index: number, event: React.PointerEvent<HTMLElement>) => void;
}

// -- Helpers -------------------------------------------------------------------

function resolveIndexByTime(points: number[], target: number): number {
  let bestIndex = -1;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index++) {
    const delta = Math.abs(points[index] - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }
  return bestIndex;
}

// -- Hook ----------------------------------------------------------------------

function useSnapMarkerDrag({ scrollContainerRef }: SnapMarkerDragConfig): SnapMarkerDrag {
  const [draggingTime, setDraggingTime] = useState<number | null>(null);
  const lastWrittenRef = useRef<number>(0);

  const onHeadPointerDown = useCallback(
    (index: number, event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const head = event.currentTarget;
      head.setPointerCapture(event.pointerId);

      const startPoints = useTimelineStore.getState().customSnapPoints;
      lastWrittenRef.current = startPoints[index] ?? 0;
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
        const store = useTimelineStore.getState();
        const currentIndex = resolveIndexByTime(store.customSnapPoints, lastWrittenRef.current);
        if (currentIndex === -1) return;
        const time = computeTime(moveEvent.clientX);
        lastWrittenRef.current = time;
        store.moveCustomSnapPoint(currentIndex, time);
        setDraggingTime(time);
      };

      const handlePointerUp = (): void => {
        head.removeEventListener("pointermove", handlePointerMove);
        head.removeEventListener("pointerup", handlePointerUp);
        head.removeEventListener("pointercancel", handlePointerUp);
        if (head.hasPointerCapture(event.pointerId)) head.releasePointerCapture(event.pointerId);
        setDraggingTime(null);
      };

      head.addEventListener("pointermove", handlePointerMove);
      head.addEventListener("pointerup", handlePointerUp);
      head.addEventListener("pointercancel", handlePointerUp);
    },
    [scrollContainerRef],
  );

  return { draggingTime, onHeadPointerDown };
}

// -- Exports -------------------------------------------------------------------

export { useSnapMarkerDrag };
export type { SnapMarkerDrag };
