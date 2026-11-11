import { useCallback, useState } from "react";

// -- Hook ---------------------------------------------------------------------

// The scroll parent a windowed list renders against, kept once found.
function useScrollParent(): [HTMLDivElement | null, (element: HTMLDivElement | null) => void] {
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  // A hidden Activity detaches refs; dropping the parent then would remount the list empty on every reveal.
  const keepScrollParent = useCallback((element: HTMLDivElement | null) => {
    if (element) setScrollParent(element);
  }, []);
  return [scrollParent, keepScrollParent];
}

// -- Exports ------------------------------------------------------------------

export { useScrollParent };
