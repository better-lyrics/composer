import { useFrameLoop } from "@/hooks/use-frame-loop";
import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";
import { type RefObject, useEffect, useRef } from "react";
import type WaveSurfer from "wavesurfer.js";

// -- Constants -----------------------------------------------------------------

// WaveSurfer's widest canvas. A window this wide keeps its canvas split, so the bars land on the same pixels.
const WAVEFORM_WINDOW_WIDTH = 8000;

// -- Functions -----------------------------------------------------------------

// Where the window starts so it covers the visible span. It moves only when the view leaves it.
function waveformWindowStart(current: number, visibleStart: number, visibleEnd: number, waveformWidth: number): number {
  const maxStart = Math.max(0, waveformWidth - WAVEFORM_WINDOW_WIDTH);
  if (current <= maxStart && current <= visibleStart && current + WAVEFORM_WINDOW_WIDTH >= visibleEnd) return current;
  const centred = visibleStart - (WAVEFORM_WINDOW_WIDTH - (visibleEnd - visibleStart)) / 2;
  return Math.round(Math.min(maxStart, Math.max(0, centred)));
}

function readWindowStart(wavesurfer: WaveSurfer, host: HTMLElement | null, current: number): number | null {
  const container = host?.closest<HTMLElement>("[data-scroll-container]");
  if (!container) return null;
  const { scrollLeft, clientWidth } = container;
  const visibleEnd = scrollLeft + Math.max(0, clientWidth - GUTTER_WIDTH);
  return waveformWindowStart(current, scrollLeft, visibleEnd, wavesurfer.getWrapper().clientWidth);
}

function writeWindowStart(wavesurfer: WaveSurfer, host: HTMLElement, start: number): void {
  host.style.translate = `${start}px 0`;
  wavesurfer.setScroll(start);
  // WaveSurfer draws newly visible canvases on its scroll event, which would otherwise land a frame late.
  wavesurfer.getWrapper().parentElement?.dispatchEvent(new Event("scroll"));
}

// -- Hooks ---------------------------------------------------------------------

// WaveSurfer draws only the canvases near its own scroll position, so the host is a window over the visible part
// of the song and WaveSurfer's scroll follows it.
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

  // A redraw lays out the canvases at the scroll position it finds, then nudges it to keep its cursor in place.
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

export { WAVEFORM_WINDOW_WIDTH, useWaveformWindow, waveformWindowStart };
