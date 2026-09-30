import { type GroupFocus, clampScrollLeft } from "@/views/timeline/group-focus";
import { currentFocusScrollRange, useEffectiveFocus } from "@/views/timeline/effective-focus";
import { scrollToInstanceHeader } from "@/views/timeline/scroll-helpers";
import { type RefObject, useEffect, useRef } from "react";

// -- Hook ----------------------------------------------------------------------

function useGroupFocusScroll(scrollContainerRef: RefObject<HTMLDivElement | null>): void {
  const focusedGroup = useEffectiveFocus();
  const previousFocusRef = useRef<GroupFocus | null>(null);

  useEffect(() => {
    const previous = previousFocusRef.current;
    previousFocusRef.current = focusedGroup;
    const container = scrollContainerRef.current;
    if (!container) return;
    if (focusedGroup === null) {
      if (previous) scrollToInstanceHeader(previous.groupId, previous.hearInstanceIdx);
      return;
    }
    const range = currentFocusScrollRange(container);
    container.scrollTop = 0;
    if (range) container.scrollLeft = range.min;

    const keepInsideInstance = () => {
      const current = currentFocusScrollRange(container);
      if (!current) return;
      const clamped = clampScrollLeft(container.scrollLeft, current);
      if (clamped !== container.scrollLeft) container.scrollLeft = clamped;
    };
    container.addEventListener("scroll", keepInsideInstance);
    return () => container.removeEventListener("scroll", keepInsideInstance);
  }, [focusedGroup, scrollContainerRef]);
}

// -- Exports -------------------------------------------------------------------

export { useGroupFocusScroll };
