import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useAudioStore } from "@/stores/audio";
import { type RulerWindow, rulerWindow } from "@/views/timeline/ruler-labels";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { viewScrollLeft } from "@/views/timeline/view-scroll";
import { useEffect, useRef, useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface RulerAnchor {
  start: number;
  viewportWidth: number;
}

// -- Helpers -------------------------------------------------------------------

function initialAnchor(): RulerAnchor {
  return { start: 0, viewportWidth: typeof window === "undefined" ? 0 : window.innerWidth };
}

function laneWidth(container: HTMLElement | null): number | null {
  return container ? Math.max(0, container.clientWidth - GUTTER_WIDTH) : null;
}

function sameWindow(a: RulerWindow, b: RulerWindow): boolean {
  return a.start === b.start && a.width === b.width;
}

function nextAnchor(rendered: RulerWindow, viewportWidth: number): RulerAnchor | null {
  const songWidth = useAudioStore.getState().duration * useTimelineStore.getState().zoom;
  const next = rulerWindow(rendered.start, viewScrollLeft(), viewportWidth, songWidth);
  return sameWindow(next, rendered) ? null : { start: next.start, viewportWidth };
}

// -- Hook ----------------------------------------------------------------------

// Renders only when the view nears the edge of the drawn window; scrolling inside it moves the track by transform alone.
function useRulerWindow(scrollContainerRef: React.RefObject<HTMLDivElement | null>, contentWidth: number): RulerWindow {
  const [anchor, setAnchor] = useState(initialAnchor);
  const labelWindow = rulerWindow(anchor.start, viewScrollLeft(), anchor.viewportWidth, contentWidth);
  const renderedRef = useRef(labelWindow);
  const viewportWidthRef = useRef(anchor.viewportWidth);

  useEffect(() => {
    renderedRef.current = labelWindow;
  });

  const follow = () => {
    const next = nextAnchor(renderedRef.current, viewportWidthRef.current);
    if (next) setAnchor(next);
  };

  // The scroll container mounts after the ruler, so its width is first readable here.
  useEffect(() => {
    viewportWidthRef.current = laneWidth(scrollContainerRef.current) ?? viewportWidthRef.current;
    const next = nextAnchor(renderedRef.current, viewportWidthRef.current);
    if (next) setAnchor(next);
  }, [scrollContainerRef]);

  useFrameLoop(
    {
      read: () => {
        viewportWidthRef.current = laneWidth(scrollContainerRef.current) ?? viewportWidthRef.current;
      },
      write: follow,
    },
    "ruler-window",
  );

  return labelWindow;
}

// -- Exports -------------------------------------------------------------------

export { useRulerWindow };
