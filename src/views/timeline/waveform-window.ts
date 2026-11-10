import { useFrameLoop } from "@/hooks/use-frame-loop";
import { scrollWindowStart } from "@/views/timeline/scroll-window";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { scrollContainerOf } from "@/views/timeline/scroll-container-of";
import { readViewScroll } from "@/views/timeline/view-scroll";
import { followWaveformZoom } from "@/views/timeline/waveform-zoom";
import { type RefObject, useEffect, useRef } from "react";
import type WaveSurfer from "wavesurfer.js";

// -- Constants -----------------------------------------------------------------

// WaveSurfer's widest canvas, so its canvas split and bar pixels stay the same.
const WAVEFORM_WINDOW_WIDTH = 8000;

// -- Functions -----------------------------------------------------------------

function readWindowStart(wavesurfer: WaveSurfer, host: HTMLElement | null, current: number): number | null {
  const container = scrollContainerOf(host);
  if (!container) return null;
  const scrollLeft = readViewScroll(container).left;
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
    let zooming = false;
    const align = () => {
      const host = hostRef.current;
      const start = readWindowStart(wavesurfer, host, startRef.current);
      if (start === null || !host) return;
      startRef.current = start;
      writeWindowStart(wavesurfer, host, start);
    };
    const unsubscribeRedraw = wavesurfer.on("redraw", () => {
      align();
      if (!zooming) queueMicrotask(align);
    });
    const stopFollowingZoom = followWaveformZoom((zoom) => {
      if (wavesurfer.options.minPxPerSec === zoom) return;
      zooming = true;
      wavesurfer.setOptions({ minPxPerSec: zoom });
      zooming = false;
      align();
    });
    const unsubscribeDestroy = wavesurfer.on("destroy", stopFollowingZoom);
    // Hidden under the spectrum the waveform keeps its old zoom; it catches up when it shows again.
    const zoom = useTimelineStore.getState().zoom;
    if (wavesurfer.options.minPxPerSec !== zoom) wavesurfer.setOptions({ minPxPerSec: zoom });
    return () => {
      stopFollowingZoom();
      unsubscribeDestroy();
      unsubscribeRedraw();
    };
  }, [wavesurfer, enabled, hostRef]);
}

// -- Exports -------------------------------------------------------------------

export { WAVEFORM_WINDOW_WIDTH, useWaveformWindow };
