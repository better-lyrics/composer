import { wake } from "@/lib/frame-loop";
import { type RefObject, useEffect } from "react";

// -- Functions -----------------------------------------------------------------

const wakeOnLayoutChange = () => wake();

// -- Hook ----------------------------------------------------------------------

function useTimelineFrameWake(
  scrollContainerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    const container = scrollContainerRef.current;
    const content = contentRef.current;
    if (!enabled || !container || !content) return;

    container.addEventListener("scroll", wakeOnLayoutChange, { passive: true });
    const observer = new ResizeObserver(wakeOnLayoutChange);
    observer.observe(content);
    observer.observe(container);

    return () => {
      container.removeEventListener("scroll", wakeOnLayoutChange);
      observer.disconnect();
    };
  }, [enabled, scrollContainerRef, contentRef]);
}

// -- Exports -------------------------------------------------------------------

export { useTimelineFrameWake };
