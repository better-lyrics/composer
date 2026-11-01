import { useCallback, useEffect, useRef, useState } from "react";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Hook ---------------------------------------------------------------------

function useRowResize(lineId: string, rowHeight: number) {
  const setRowHeight = useTimelineStore((s) => s.setRowHeight);
  const defaultRowHeight = useTimelineStore((s) => s.defaultRowHeight);
  const [isResizing, setIsResizing] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // react-doctor-disable-next-line react-doctor/exhaustive-deps
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setIsResizing(true);
      const startY = e.clientY;
      const startHeight = rowHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        setRowHeight(lineId, startHeight + moveEvent.clientY - startY);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        cleanupRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      cleanupRef.current = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [lineId, rowHeight, setRowHeight],
  );

  const resetHeight = useCallback(
    () => setRowHeight(lineId, defaultRowHeight),
    [lineId, defaultRowHeight, setRowHeight],
  );

  return { isResizing, startResize, resetHeight };
}

// -- Exports ------------------------------------------------------------------

export { useRowResize };
