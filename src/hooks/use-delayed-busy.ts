import { useEffect, useRef, useState } from "react";

// -- Constants -----------------------------------------------------------------

const SHOW_AFTER_MS = 200;
const MIN_VISIBLE_MS = 300;

// -- Hooks ---------------------------------------------------------------------

function useDelayedBusy(busy: boolean): boolean {
  const [shown, setShown] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (busy === shown) return;
    if (busy) {
      const timer = window.setTimeout(() => {
        shownAt.current = performance.now();
        setShown(true);
      }, SHOW_AFTER_MS);
      return () => window.clearTimeout(timer);
    }
    const remaining = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt.current));
    const timer = window.setTimeout(() => setShown(false), remaining);
    return () => window.clearTimeout(timer);
  }, [busy, shown]);

  return shown;
}

// -- Exports -------------------------------------------------------------------

export { useDelayedBusy };
