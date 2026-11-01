import { type RefObject, useCallback, useEffect, useRef } from "react";
import { readViewScroll, scrollView } from "@/views/timeline/view-scroll";

// -- Hook ----------------------------------------------------------------------

function useTimelinePan(scrollContainerRef: RefObject<HTMLDivElement | null>) {
  const isPanningRef = useRef(false);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const panStartScrollRef = useRef(0);
  const panStartScrollTopRef = useRef(0);
  const panAxisLockRef = useRef<"x" | "y" | null>(null);

  const handlePanMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartXRef.current = e.clientX;
        panStartYRef.current = e.clientY;
        const container = scrollContainerRef.current;
        const start = container ? readViewScroll(container) : { left: 0, top: 0 };
        panStartScrollRef.current = start.left;
        panStartScrollTopRef.current = start.top;
        panAxisLockRef.current = null;
        scrollContainerRef.current?.classList.add("is-panning");
      }
    },
    [scrollContainerRef],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = scrollContainerRef.current;
      if (!isPanningRef.current || !container) return;
      const deltaX = panStartXRef.current - e.clientX;
      const deltaY = panStartYRef.current - e.clientY;

      if (e.shiftKey && !panAxisLockRef.current) {
        panAxisLockRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      }

      const lock = e.shiftKey ? panAxisLockRef.current : null;
      scrollView(
        container,
        lock === "y" ? null : panStartScrollRef.current + deltaX,
        lock === "x" ? null : panStartScrollTopRef.current + deltaY,
      );
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
      scrollContainerRef.current?.classList.remove("is-panning");
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [scrollContainerRef]);

  return { handlePanMouseDown };
}

// -- Exports -------------------------------------------------------------------

export { useTimelinePan };
