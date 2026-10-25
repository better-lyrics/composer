import { CHUNK_FRAMES } from "@/domain/spectrum/chunk-order";
import type { RowBinTable } from "@/domain/spectrum/frequency-scale";
import { brightness, decodeDb } from "@/domain/spectrum/levels";
import type { PaletteLookup } from "@/domain/spectrum/palettes";
import type { PhaseColours, SpectrumPalette } from "@/domain/spectrum/settings";
import { TILE_WIDTH } from "@/domain/spectrum/tile-key";
import type { SpectrumSessionState } from "@/views/timeline/spectrum/spectrum-session";

// -- Interfaces ----------------------------------------------------------------

interface TileRenderInputs {
  session: SpectrumSessionState;
  table: RowBinTable;
  lookup: PaletteLookup;
  palette: SpectrumPalette;
  phase: PhaseColours;
  contrastDb: number;
  pixelsPerSecond: number;
  pixelRatio: number;
  heightPx: number;
  index: number;
}

interface RenderedTile {
  canvas: OffscreenCanvas;
  complete: boolean;
  bytes: number;
}

// -- Constants -----------------------------------------------------------------

const BLACK = 0xff000000;
const PENDING_DOT = 0xff4a4440;
const PENDING_DOT_SPACING_CSS = 6;
const PHASE_LIT_START = 0.22;
const PHASE_LIT_SPAN = 0.4;

// -- Functions -----------------------------------------------------------------

function chunkIsReady(chunkReady: Uint8Array, frame: number): boolean {
  return chunkReady[Math.floor(frame / CHUNK_FRAMES)] === 1;
}

function fillPendingColumn(pixels: Uint32Array, width: number, height: number, column: number, dot: number): void {
  const dottedColumn = column % dot === 0;
  for (let y = 0; y < height; y++) pixels[y * width + column] = dottedColumn && y % dot === 0 ? PENDING_DOT : BLACK;
}

function fillColumn(pixels: Uint32Array, width: number, height: number, column: number, colour: number): void {
  for (let y = 0; y < height; y++) pixels[y * width + column] = colour;
}

// Ported from the design mock: each pixel takes the loudest bin across the frames and rows it covers.
function renderTile(inputs: TileRenderInputs): RenderedTile {
  const { session, table, lookup, pixelRatio, pixelsPerSecond, index } = inputs;
  const width = Math.round(TILE_WIDTH * pixelRatio);
  const height = inputs.heightPx;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  const { magnitude, phaseChange, chunkReady, bins, frames } = session;
  if (!context || !magnitude || !phaseChange || !chunkReady)
    return { canvas, complete: false, bytes: width * height * 4 };

  const image = context.createImageData(width, height);
  const pixels = new Uint32Array(image.data.buffer);
  const framesPerSecond = session.sampleRate / session.hop;
  const tileStart = index * TILE_WIDTH;
  const dot = Math.round(PENDING_DOT_SPACING_CSS * pixelRatio);
  const showsPhase = inputs.palette === "phase";
  const wantsRaw = showsPhase && inputs.phase === "raw";
  const floorDb = inputs.contrastDb;
  let complete = true;

  for (let column = 0; column < width; column++) {
    const startTime = (tileStart + column / pixelRatio) / pixelsPerSecond;
    const endTime = (tileStart + (column + 1) / pixelRatio) / pixelsPerSecond;
    const firstFrame = Math.round(startTime * framesPerSecond);
    const endFrame = Math.min(frames, Math.max(firstFrame + 1, Math.round(endTime * framesPerSecond)));
    if (firstFrame < 0 || firstFrame >= frames) {
      fillColumn(pixels, width, height, column, BLACK);
      continue;
    }
    if (!chunkIsReady(chunkReady, firstFrame) || !chunkIsReady(chunkReady, endFrame - 1)) {
      complete = false;
      fillPendingColumn(pixels, width, height, column, dot);
      continue;
    }
    const rawReady =
      wantsRaw && session.rawPhase !== null && session.rawReady?.[Math.floor(firstFrame / CHUNK_FRAMES)] === 1;
    const red = rawReady && session.rawPhase ? session.rawPhase : phaseChange;
    for (let y = 0; y < height; y++) {
      let loudest = 0;
      let at = 0;
      const spanStart = table.spanStart[y];
      const spanEnd = table.spanEnd[y];
      if (spanEnd < 0) {
        const fraction = table.fraction[y];
        for (let frame = firstFrame; frame < endFrame; frame++) {
          const offset = frame * bins + spanStart;
          const level = magnitude[offset] * (1 - fraction) + magnitude[offset + 1] * fraction;
          if (level > loudest) {
            loudest = level;
            at = fraction > 0.5 ? offset + 1 : offset;
          }
        }
      } else {
        for (let frame = firstFrame; frame < endFrame; frame++) {
          const row = frame * bins;
          for (let bin = spanStart; bin < spanEnd; bin++) {
            const level = magnitude[row + bin];
            if (level > loudest) {
              loudest = level;
              at = row + bin;
            }
          }
        }
      }
      const value = brightness(decodeDb(loudest) + table.tiltDb[y], floorDb);
      const level = (value * 255) | 0;
      let r = lookup.r[level];
      if (showsPhase) {
        const lit = (red[at] / 255) * Math.min(1, Math.max(0, (value - PHASE_LIT_START) / PHASE_LIT_SPAN)) * 255;
        if (lit > r) r = lit | 0;
      }
      pixels[y * width + column] = BLACK | (lookup.b[level] << 16) | (lookup.g[level] << 8) | r;
    }
  }
  context.putImageData(image, 0, 0);
  return { canvas, complete, bytes: width * height * 4 };
}

// -- Exports -------------------------------------------------------------------

export { renderTile };
export type { RenderedTile, TileRenderInputs };
