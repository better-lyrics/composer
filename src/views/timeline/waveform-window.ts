import { useFrameLoop } from "@/hooks/use-frame-loop";
import { scrollWindowStart } from "@/views/timeline/scroll-window";
import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";
import { viewScrollLeft } from "@/views/timeline/view-scroll";
import { type RefObject, useEffect, useRef } from "react";
import type WaveSurfer from "wavesurfer.js";

// -- Constants -----------------------------------------------------------------

// WaveSurfer's widest canvas, so its canvas split and bar pixels stay the same.
const WAVEFORM_WINDOW_WIDTH = 8000;

// -- Functions -----------------------------------------------------------------

function readWindowStart(wavesurfer: WaveSurfer, host: HTMLElement | null, current: number): number | null {
  const container = host?.closest<HTMLElement>("[data-scroll-container]");
  if (!container) return null;
  const scrollLeft = viewScrollLeft();
  const visibleEnd = scrollLeft + Math.max(0, container.clientWidth - GUTTER_WIDTH);
  return scrollWindowStart(current, scrollLeft, visibleEnd, wavesurfer.getWrapper().clientWidth, WAVEFORM_WINDOW_WIDTH);
}

function writeWindowStart(wavesurfer: WaveSurfer, host: HTMLElement, start: number): void {
  host.style.translate = `${start}px 0`;
  wavesurfer.setScroll(start);
  // A programmatic scroll event lands a frame late, and WaveSurfer draws new canvases on it.
  wavesurfer.getWrapper().parentElement?.dispatchEvent(new Event("scroll"));
}

// -- Hooks ---------------------------------------------------------------------

function useWaveformWindow(
  wavesurfer: WaveSurfer | null,
  hostRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
): void {
  const startRef = useRef(0);
  const pendingRef = useRef(false);

  useFrameLoop(
    {
      read: () => {
        if (!wavesurfer) return;
        const start = readWindowStart(wavesurfer, hostRef.current, startRef.current);
        pendingRef.current = start !== null && (start !== startRef.current || wavesurfer.getScroll() !== start);
        if (pendingRef.current && start !== null) startRef.current = start;
      },
      write: () => {
        const host = hostRef.current;
        if (!pendingRef.current || !wavesurfer || !host) return;
        pendingRef.current = false;
        writeWindowStart(wavesurfer, host, startRef.current);
      },
    },
    "waveform window",
    enabled && wavesurfer !== null,
  );

  // reRender nudges the scroll after drawing to keep its cursor in place.
  useEffect(() => {
    if (!wavesurfer || !enabled) return;
    const align = () => {
      const host = hostRef.current;
      const start = readWindowStart(wavesurfer, host, startRef.current);
      if (start === null || !host) return;
      startRef.current = start;
      writeWindowStart(wavesurfer, host, start);
    };
    const unsubscribe = wavesurfer.on("redraw", () => {
      align();
      queueMicrotask(align);
    });
    return () => unsubscribe();
  }, [wavesurfer, enabled, hostRef]);
}

// -- Exports -------------------------------------------------------------------

export { WAVEFORM_WINDOW_WIDTH, useWaveformWindow };
