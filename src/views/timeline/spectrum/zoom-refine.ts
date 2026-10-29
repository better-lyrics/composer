import { TILE_WIDTH } from "@/domain/spectrum/tile-key";
import { type StretchSource, stretchedBaseRect } from "@/domain/spectrum/zoom-stretch";
import { spectrumRefineMotion } from "@/utils/animationVariants";
import { prefersReducedMotion } from "@/utils/prefers-reduced-motion";
import type { RefineDraw } from "@/views/timeline/spectrum/tile-cache";

// -- Interfaces ----------------------------------------------------------------

interface DrawnFrame extends StretchSource {
  heightCss: number;
  pixelRatio: number;
  lookKey: string;
}

interface ZoomRefine {
  base: OffscreenCanvas | null;
  baseFrame: DrawnFrame | null;
  lastFrame: DrawnFrame | null;
  beganAt: number;
  fades: Map<number, number>;
  reducedMotion: boolean;
}

// -- Constants -----------------------------------------------------------------

const REFINE_BUILD_MS = 4;

// -- Functions -----------------------------------------------------------------

function fadeInAlpha(elapsedMs: number, durationMs: number): number {
  if (elapsedMs >= durationMs) return 1;
  return spectrumRefineMotion.ease(Math.max(0, elapsedMs) / durationMs);
}

function createZoomRefine(): ZoomRefine {
  return { base: null, baseFrame: null, lastFrame: null, beganAt: -1, fades: new Map(), reducedMotion: false };
}

function copyOf(target: OffscreenCanvas | null, canvas: HTMLCanvasElement): OffscreenCanvas | null {
  const copy =
    target && target.width === canvas.width && target.height === canvas.height
      ? target
      : new OffscreenCanvas(canvas.width, canvas.height);
  const context = copy.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, copy.width, copy.height);
  context.drawImage(canvas, 0, 0);
  return copy;
}

function sameBand(a: DrawnFrame, b: DrawnFrame): boolean {
  return a.heightCss === b.heightCss && a.pixelRatio === b.pixelRatio && a.lookKey === b.lookKey;
}

function endRefine(refine: ZoomRefine): void {
  refine.base = null;
  refine.baseFrame = null;
  refine.fades.clear();
}

function beginRefineIfZoomed(refine: ZoomRefine, canvas: HTMLCanvasElement, next: DrawnFrame, now: number): void {
  const last = refine.lastFrame;
  if (!last || last.pixelsPerSecond === next.pixelsPerSecond) return;
  if (!sameBand(last, next) || canvas.width === 0) {
    endRefine(refine);
    return;
  }
  refine.base = copyOf(refine.base, canvas);
  refine.baseFrame = refine.base ? last : null;
  refine.beganAt = now;
  refine.fades.clear();
  refine.reducedMotion = prefersReducedMotion();
}

function refineDraw(refine: ZoomRefine, frame: DrawnFrame, now: number): RefineDraw | undefined {
  const { base, baseFrame } = refine;
  if (!base || !baseFrame) return undefined;
  if (!sameBand(baseFrame, frame)) {
    endRefine(refine);
    return undefined;
  }
  return {
    deadline: now + REFINE_BUILD_MS,
    underlay: (context) => {
      const { x, width } = stretchedBaseRect(baseFrame, frame);
      context.drawImage(base, x, 0, width, frame.heightCss);
    },
  };
}

function blitRefining(
  refine: ZoomRefine,
  context: CanvasRenderingContext2D,
  tile: OffscreenCanvas,
  index: number,
  x: number,
  heightCss: number,
  now: number,
): boolean {
  let start = refine.fades.get(index);
  if (start === undefined) {
    const readyWhenRefineBegan = now === refine.beganAt;
    start = readyWhenRefineBegan ? Number.NEGATIVE_INFINITY : now;
    refine.fades.set(index, start);
  }
  const alpha = fadeInAlpha(
    now - start,
    refine.reducedMotion ? spectrumRefineMotion.reducedFadeMs : spectrumRefineMotion.fadeMs,
  );
  if (alpha >= 1) {
    context.drawImage(tile, x, 0, TILE_WIDTH, heightCss);
    return false;
  }
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(tile, x, 0, TILE_WIDTH, heightCss);
  context.restore();
  return true;
}

// -- Exports -------------------------------------------------------------------

export { beginRefineIfZoomed, blitRefining, createZoomRefine, endRefine, refineDraw };
export type { DrawnFrame };
