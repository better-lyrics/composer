import { type RefObject, useEffect } from "react";

// -- Hook ----------------------------------------------------------------------

// A passive effect: the scroll container mounts after its siblings, so its ref is set only once layout effects ran.
function useFollowHorizontalScroll(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  enabled = true,
): void {
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!enabled || !container) return;
    const follow = () => {
      if (trackRef.current) trackRef.current.style.translate = `${-container.scrollLeft}px 0`;
    };
    follow();
    container.addEventListener("scroll", follow, { passive: true });
    return () => container.removeEventListener("scroll", follow);
  }, [scrollContainerRef, trackRef, enabled]);
}

// -- Exports -------------------------------------------------------------------

export { useFollowHorizontalScroll };
