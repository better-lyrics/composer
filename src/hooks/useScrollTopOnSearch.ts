import { type RefObject, useLayoutEffect, useRef } from "react";

// -- Hook ----------------------------------------------------------------------

// The query a modal reopens with is not a change, so a restored scroll position survives it.
function useScrollTopOnSearch(viewportRef: RefObject<HTMLElement | null>, query: string): void {
  const lastQueryRef = useRef(query);
  useLayoutEffect(() => {
    if (lastQueryRef.current === query) return;
    lastQueryRef.current = query;
    if (query.trim()) viewportRef.current?.scrollTo({ top: 0 });
  }, [viewportRef, query]);
}

// -- Exports -------------------------------------------------------------------

export { useScrollTopOnSearch };
