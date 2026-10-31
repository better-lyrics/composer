import { useFrameLoop } from "@/hooks/use-frame-loop";
import { onCueFlash } from "@/lib/replay-cue";
import { timeToX } from "@/views/timeline/coords";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { viewScrollLeft } from "@/views/timeline/view-scroll";
import { useEffect, useRef } from "react";

// -- Interfaces ----------------------------------------------------------------

interface CueFlashProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

// -- Constants -----------------------------------------------------------------

const FLASH_HOLD_MS = 450;
const FLASH_FADE_MS = 400;

// -- Helpers -------------------------------------------------------------------

function placeFlashLine(line: HTMLDivElement, time: number, container: HTMLDivElement | null): void {
  line.style.transform = `translate3d(${timeToX(time, useTimelineStore.getState().zoom, viewScrollLeft())}px, 0, 0)`;
  if (container) line.style.height = `${container.scrollHeight}px`;
}

// -- Components ----------------------------------------------------------------

const CueFlash: React.FC<CueFlashProps> = ({ scrollContainerRef }) => {
  const lineRef = useRef<HTMLDivElement>(null);
  const flashTimeRef = useRef<number | null>(null);

  useFrameLoop(() => {
    if (lineRef.current && flashTimeRef.current !== null)
      placeFlashLine(lineRef.current, flashTimeRef.current, scrollContainerRef.current);
  }, "cue-flash");

  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onCueFlash((time) => {
      flashTimeRef.current = time;
      const line = lineRef.current;
      if (!line) return;
      placeFlashLine(line, time, scrollContainerRef.current);
      line.setAttribute("data-flash", "");
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        lineRef.current?.removeAttribute("data-flash");
        clearTimer = setTimeout(() => {
          flashTimeRef.current = null;
        }, FLASH_FADE_MS);
      }, FLASH_HOLD_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(clearTimer);
    };
  }, [scrollContainerRef]);

  return (
    <div
      ref={lineRef}
      aria-hidden="true"
      className="absolute top-0 left-0 w-px opacity-0 transition-opacity duration-400 ease-out pointer-events-none bg-[color-mix(in_oklab,var(--color-composer-text)_55%,transparent)] data-[flash]:opacity-100 data-[flash]:duration-[60ms]"
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { CueFlash };
