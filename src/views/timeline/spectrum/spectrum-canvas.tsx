import { CHUNK_FRAMES } from "@/domain/spectrum/chunk-order";
import { spectrumLookOf } from "@/domain/spectrum/settings";
import { visibleTileRange } from "@/domain/spectrum/tile-key";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { animateFrames } from "@/lib/frame-loop";
import { useSettingsStore } from "@/stores/settings";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { sizeCanvas } from "@/views/timeline/size-canvas";
import { spectrumSession } from "@/views/timeline/spectrum/spectrum-session";
import { beginWarmUp, blitWarming, createWarmUp, noteDrawnTiles } from "@/views/timeline/spectrum/spectrum-warm-up";
import { resolveSpectrumPalette } from "@/views/timeline/spectrum/theme-palette";
import { type TileView, drawTiles } from "@/views/timeline/spectrum/tile-cache";
import { requestSpectrumRawPhase } from "@/views/timeline/spectrum/use-spectrum-session";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef, useState } from "react";

// -- Constants -----------------------------------------------------------------

const BAND_BORDER = 1;

// -- Helpers -------------------------------------------------------------------

function drawingSignature(view: TileView): string {
  const { look, session } = view;
  return [
    view.scrollLeft,
    view.pixelsPerSecond,
    view.viewportWidth,
    view.heightCss,
    view.pixelRatio,
    session.generation,
    session.readyChunks,
    session.rawChunks,
    look.spectrumPalette,
    look.spectrumContrast,
    look.spectrumScale,
    look.spectrumTop,
    look.spectrumPhase,
    view.themeGeneration,
  ].join("|");
}

const requestedRawChunks = { generation: -1, chunks: new Set<number>() };

function requestVisibleRawPhase(view: TileView): void {
  if (view.look.spectrumPalette !== "phase" || view.look.spectrumPhase !== "raw") return;
  const { session } = view;
  if (requestedRawChunks.generation !== session.generation) {
    requestedRawChunks.generation = session.generation;
    requestedRawChunks.chunks.clear();
  }
  const framesPerSecond = session.sampleRate / session.hop;
  const chunkAt = (px: number) =>
    Math.max(0, Math.floor(((px / view.pixelsPerSecond) * framesPerSecond) / CHUNK_FRAMES));
  const wanted: number[] = [];
  for (let chunk = chunkAt(view.scrollLeft); chunk <= chunkAt(view.scrollLeft + view.viewportWidth); chunk++) {
    if (requestedRawChunks.chunks.has(chunk) || session.rawReady?.[chunk] === 1) continue;
    wanted.push(chunk);
  }
  if (wanted.length > 0 && requestSpectrumRawPhase(wanted)) {
    for (const chunk of wanted) requestedRawChunks.chunks.add(chunk);
  }
}

// -- Components ----------------------------------------------------------------

const SpectrumCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnRef = useRef<string | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const [warmUp] = useState(createWarmUp);

  useEffect(() => {
    warmUp.generation = -1;
    return () => {
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, [warmUp]);

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
    const signature = drawingSignature(view);
    if (signature === drawnRef.current) return;

    sizeCanvas(canvas, view.viewportWidth, view.heightCss, view.pixelRatio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
    if (!spectrumSession.magnitude || view.pixelsPerSecond <= 0) {
      context.clearRect(0, 0, view.viewportWidth, view.heightCss);
      drawnRef.current = null;
      return;
    }
    requestVisibleRawPhase(view);
    const now = performance.now();
    if (warmUp.generation !== spectrumSession.generation) {
      const { first, last } = visibleTileRange(view.scrollLeft, view.viewportWidth);
      const visible = Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
      beginWarmUp(warmUp, visible, spectrumSession.generation, now);
    }
    const result = drawTiles(
      context,
      view,
      (target, tile, index, x) => blitWarming(warmUp, target, tile, index, x, view.heightCss, now),
      (complete, incomplete) => noteDrawnTiles(warmUp, complete, incomplete, now),
    );
    const idle = result.settled && !result.animating;
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
