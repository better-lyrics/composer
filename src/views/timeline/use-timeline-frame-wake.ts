import { wake } from "@/lib/frame-loop";
import { type RefObject, useEffect } from "react";

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

    container.addEventListener("scroll", wake, { passive: true });
    const observer = new ResizeObserver(wake);
    observer.observe(content);

    return () => {
      container.removeEventListener("scroll", wake);
      observer.disconnect();
    };
  }, [enabled, scrollContainerRef, contentRef]);
}

// -- Exports -------------------------------------------------------------------

export { useTimelineFrameWake };
