import { type RefObject, useCallback, useRef } from "react";

// -- Hook ----------------------------------------------------------------------

function useTrackedScrollTop(initialScrollTop: number): [RefObject<number>, (scrollTop: number) => void] {
  const scrollTopRef = useRef(initialScrollTop);
  const trackScrollTop = useCallback((scrollTop: number) => {
    scrollTopRef.current = scrollTop;
  }, []);
  return [scrollTopRef, trackScrollTop];
}

// -- Exports -------------------------------------------------------------------

export { useTrackedScrollTop };
