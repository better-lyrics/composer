import { useEffect, useRef } from "react";
import { formatTime } from "@/utils/format-time";
import { bandPointerTime, clearBandPointer, trackBandPointer } from "@/views/timeline/step-timing/pointer-write-time";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Components ----------------------------------------------------------------

const StepWriteGuide: React.FC = () => {
  const stepTiming = useTimelineStore((s) => s.stepTiming);
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const container = root?.parentElement?.querySelector<HTMLElement>("[data-scroll-container]");
    const band = container?.querySelector<HTMLElement>("[data-overview-band]");
    const line = lineRef.current;
    if (!stepTiming || !root || !container || !band || !line) return;
    const hide = () => {
      clearBandPointer();
      line.hidden = true;
    };
    const handlePointerMove = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest("[data-band-resize-handle]")) return hide();
      trackBandPointer(e.clientX, container);
      const time = bandPointerTime();
      if (time === null || !timeRef.current) return;
      line.hidden = false;
      line.style.transform = `translateX(${e.clientX - root.getBoundingClientRect().left}px)`;
      timeRef.current.textContent = formatTime(time);
    };
    band.addEventListener("pointermove", handlePointerMove);
    band.addEventListener("pointerleave", hide);
    return () => {
      band.removeEventListener("pointermove", handlePointerMove);
      band.removeEventListener("pointerleave", hide);
      hide();
    };
  }, [stepTiming]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-45 overflow-hidden"
      style={{ clipPath: `inset(0 0 0 ${GUTTER_WIDTH}px)` }}
    >
      <div
        ref={lineRef}
        hidden
        className="absolute inset-y-0 left-0 w-0 border-l border-[color-mix(in_oklab,var(--ink)_70%,transparent)]"
      >
        <span
          ref={timeRef}
          className="absolute top-1 left-1 rounded-[5px] bg-(--pop) px-1.5 font-mono text-[10.5px] font-medium tabular-nums text-(--ink) shadow-[inset_0_0_0_1px_var(--edge)] whitespace-nowrap select-text"
        />
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { StepWriteGuide };
