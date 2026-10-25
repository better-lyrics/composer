import { CHUNK_FRAMES } from "@/domain/spectrum/chunk-order";
import type { SpectrumLook } from "@/domain/spectrum/settings";
import { TILE_WIDTH } from "@/domain/spectrum/tile-key";
import { useFrameLoop } from "@/hooks/use-frame-loop";
import { animateFrames } from "@/lib/frame-loop";
import { useSettingsStore } from "@/stores/settings";
import { currentOverviewBandHeight } from "@/views/timeline/overview-band-height";
import { spectrumSession } from "@/views/timeline/spectrum/spectrum-session";
import { resolveSpectrumPalette } from "@/views/timeline/spectrum/theme-palette";
import { type TileView, drawTiles } from "@/views/timeline/spectrum/tile-cache";
import { requestSpectrumRawPhase } from "@/views/timeline/spectrum/use-spectrum-session";
import { GUTTER_WIDTH, useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect, useRef } from "react";

// -- Constants -----------------------------------------------------------------

const BAND_BORDER = 1;

// -- Helpers -------------------------------------------------------------------

function lookOf(): SpectrumLook {
  const s = useSettingsStore.getState();
  return {
    spectrumSource: s.spectrumSource,
    spectrumPalette: s.spectrumPalette,
    spectrumContrast: s.spectrumContrast,
    spectrumScale: s.spectrumScale,
    spectrumTop: s.spectrumTop,
    spectrumWindow: s.spectrumWindow,
    spectrumPhase: s.spectrumPhase,
  };
}

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
    look.spectrumPalette,
    look.spectrumContrast,
    look.spectrumScale,
    look.spectrumTop,
    look.spectrumPhase,
    view.themeGeneration,
  ].join("|");
}

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio: number): void {
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
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
    requestedRawChunks.chunks.add(chunk);
    wanted.push(chunk);
  }
  if (wanted.length > 0) requestSpectrumRawPhase(wanted);
}

// -- Components ----------------------------------------------------------------

const SpectrumCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnRef = useRef<string | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      releaseRef.current?.();
      releaseRef.current = null;
    },
    [],
  );

  useFrameLoop(() => {
    const canvas = canvasRef.current;
    const container = canvas?.closest<HTMLElement>("[data-scroll-container]");
    if (!canvas || !container) return;
    const look = lookOf();
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
    const result = drawTiles(context, view, (target, tile, _index, x) =>
      target.drawImage(tile, x, 0, TILE_WIDTH, view.heightCss),
    );
    drawnRef.current = result.settled ? signature : null;
    if (result.settled) {
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
