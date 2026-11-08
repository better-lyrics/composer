import { useEffect, useEffectEvent, useRef } from "react";

// -- Constants -----------------------------------------------------------------

// Starts the next page a little before the end comes into view.
const LOOKAHEAD_MARGIN = "400px";

// -- Hook ----------------------------------------------------------------------

// Pass `enabled` false while a page loads: turning it back on observes again, so a short page keeps loading.

function useLoadWhenVisible<T extends Element>(enabled: boolean, load: () => void) {
  const ref = useRef<T>(null);
  const loadNext = useEffectEvent(load);

  useEffect(() => {
    const target = ref.current;
    if (!enabled || !target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadNext();
      },
      { rootMargin: LOOKAHEAD_MARGIN },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

// -- Exports -------------------------------------------------------------------

export { useLoadWhenVisible };
