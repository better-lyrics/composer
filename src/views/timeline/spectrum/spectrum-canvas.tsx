import { spectrumLookOf } from "@/domain/spectrum/settings";
import { visibleTileRange } from "@/domain/spectrum/tile-key";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { animateFrames } from "@/lib/frame-loop";
import { useSettingsStore } from "@/stores/settings";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { sizeCanvas } from "@/views/timeline/size-canvas";
import { spectrumSession } from "@/views/timeline/spectrum/spectrum-session";
import {
  beginWarmUp,
  blitWarming,
  createWarmUp,
  isWarming,
  noteDrawnTiles,
} from "@/views/timeline/spectrum/spectrum-warm-up";
import { resolveSpectrumPalette } from "@/views/timeline/spectrum/theme-palette";
import { type TileView, drawTiles } from "@/views/timeline/spectrum/tile-cache";
import {
  type DrawnFrame,
  beginRefineIfZoomed,
  blitRefining,
  createZoomRefine,
  endRefine,
  refineDraw,
} from "@/views/timeline/spectrum/zoom-refine";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef, useState } from "react";

// -- Constants -----------------------------------------------------------------

const BAND_BORDER = 1;

// -- Helpers -------------------------------------------------------------------

function lookKey(view: TileView): string {
  const { look } = view;
  return [
    look.spectrumPalette,
    look.spectrumContrast,
    look.spectrumScale,
    look.spectrumTop,
    look.spectrumPhase,
    view.themeGeneration,
  ].join("|");
}

function drawingSignature(view: TileView, look: string): string {
  const { session } = view;
  return [
    view.scrollLeft,
    view.pixelsPerSecond,
    view.viewportWidth,
    view.heightCss,
    view.pixelRatio,
    session.generation,
    session.readyChunks,
    session.rawChunks,
    look,
  ].join("|");
}

// -- Components ----------------------------------------------------------------

const SpectrumCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnRef = useRef<string | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const [warmUp] = useState(createWarmUp);
  const [refine] = useState(createZoomRefine);

  useEffect(() => {
    warmUp.generation = -1;
    refine.lastFrame = null;
    endRefine(refine);
    return () => {
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, [warmUp, refine]);

  useFrameLoop(() => {
    const canvas = canvasRef.current;
    const container = canvas?.closest<HTMLElement>("[data-scroll-container]");
    if (!canvas || !container) return;
    const look = spectrumLookOf(useSettingsStore.getState());
    const palette = resolveSpectrumPalette(look.spectrumPalette);
    const view: TileView = {
      session: spectrumSession,
      look,
      lookup: palette.lookup,
      themeGeneration: palette.themeGeneration,
      pixelsPerSecond: useTimelineStore.getState().zoom,
      pixelRatio: window.devicePixelRatio || 1,
      heightCss: currentOverviewBandHeight() - BAND_BORDER,
      scrollLeft: container.scrollLeft,
      viewportWidth: Math.max(0, container.clientWidth - GUTTER_WIDTH),
    };
    const lookId = lookKey(view);
    const signature = drawingSignature(view, lookId);
    if (signature === drawnRef.current) return;

    const frame: DrawnFrame = {
      pixelsPerSecond: view.pixelsPerSecond,
      scrollLeft: view.scrollLeft,
      widthCss: view.viewportWidth,
      heightCss: view.heightCss,
      pixelRatio: view.pixelRatio,
      lookKey: lookId,
    };
    const now = performance.now();
    if (warmUp.generation !== spectrumSession.generation) endRefine(refine);
    else if (!isWarming(warmUp, spectrumSession.generation, now)) beginRefineIfZoomed(refine, canvas, frame, now);

    sizeCanvas(canvas, view.viewportWidth, view.heightCss, view.pixelRatio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
    if (!spectrumSession.magnitude || view.pixelsPerSecond <= 0) {
      context.clearRect(0, 0, view.viewportWidth, view.heightCss);
      drawnRef.current = null;
      refine.lastFrame = null;
      endRefine(refine);
      return;
    }
    if (warmUp.generation !== spectrumSession.generation) {
      const { first, last } = visibleTileRange(view.scrollLeft, view.viewportWidth);
      const visible = Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
      beginWarmUp(warmUp, visible, spectrumSession.generation, now);
    }
    const refining = refineDraw(refine, frame, now);
    const result = drawTiles(
      context,
      view,
      refining
        ? (target, tile, index, x) =>
            warmUp.starts.has(index)
              ? blitWarming(warmUp, target, tile, index, x, view.heightCss, now)
              : blitRefining(refine, target, tile, index, x, view.heightCss, now)
        : (target, tile, index, x) => blitWarming(warmUp, target, tile, index, x, view.heightCss, now),
      (complete, incomplete) => noteDrawnTiles(warmUp, complete, incomplete, now),
      refining,
    );
    refine.lastFrame = frame;
    const settledRefine = refining !== undefined && result.settled && !result.animating;
    // The last refine frame still has the stretched band under it, so one plain frame follows.
    if (settledRefine) endRefine(refine);
    const idle = result.settled && !result.animating && !settledRefine;
    drawnRef.current = idle ? signature : null;
    if (idle) {
      releaseRef.current?.();
      releaseRef.current = null;
    } else {
      releaseRef.current ??= animateFrames("spectrum tiles");
    }
  }, "spectrum canvas");

  return <canvas ref={canvasRef} data-spectrum-canvas className="absolute top-0 left-0 bg-black" />;
};

// -- Exports -------------------------------------------------------------------

export { SpectrumCanvas };
