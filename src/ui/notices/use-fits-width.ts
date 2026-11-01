import { useLayoutEffect, useRef, useState } from "react";

// -- Hook ---------------------------------------------------------------------

// Measured once per content key while shown in full, since the compact form cannot report the full width.
function useFitsWidth(contentKey: string, chromePx: number) {
  const [wrapper, wrapperRef] = useState<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [measured, setMeasured] = useState<{ key: string; width: number } | null>(null);
  const [available, setAvailable] = useState(Number.POSITIVE_INFINITY);
  const fullWidth = measured?.key === contentKey ? measured.width : null;
  const fits = fullWidth === null || fullWidth + chromePx <= available;

  useLayoutEffect(() => {
    if (fullWidth !== null || !contentRef.current) return;
    setMeasured({ key: contentKey, width: contentRef.current.getBoundingClientRect().width });
  }, [contentKey, fullWidth]);

  useLayoutEffect(() => {
    if (!wrapper) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [wrapper]);

  return { wrapperRef, contentRef, fits };
}

// -- Exports ------------------------------------------------------------------

export { useFitsWidth };
