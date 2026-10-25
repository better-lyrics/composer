import { ByteLru } from "@/domain/spectrum/byte-lru";
import { type RowBinTable, rowBinTable } from "@/domain/spectrum/frequency-scale";
import type { PaletteLookup } from "@/domain/spectrum/palettes";
import type { SpectrumLook } from "@/domain/spectrum/settings";
import { TILE_WIDTH, tileKey, visibleTileRange } from "@/domain/spectrum/tile-key";
import { renderTile } from "@/views/timeline/spectrum/render-tile";
import type { SpectrumSessionState } from "@/views/timeline/spectrum/spectrum-session";

// -- Interfaces ----------------------------------------------------------------

interface TileView {
  session: SpectrumSessionState;
  look: SpectrumLook;
  lookup: PaletteLookup;
  themeGeneration: number;
  pixelsPerSecond: number;
  pixelRatio: number;
  heightCss: number;
  scrollLeft: number;
  viewportWidth: number;
}

interface TileBudget {
  remaining: number;
}

interface PendingTile {
  canvas: OffscreenCanvas;
  readyChunks: number;
}

// Returns true while the tile is still animating in.
type TileBlit = (context: CanvasRenderingContext2D, tile: OffscreenCanvas, index: number, x: number) => boolean;

interface DrawResult {
  settled: boolean;
  animating: boolean;
}

// -- Constants -----------------------------------------------------------------

const TILE_CACHE_BYTES = 160 * 1024 * 1024;
const TILE_BUILD_BUDGET = 10;
const MAX_ROW_TABLES = 8;
const MAX_PENDING_TILES = 32;

// -- State ---------------------------------------------------------------------

const tiles = new ByteLru<OffscreenCanvas>(TILE_CACHE_BYTES);
const pendingTiles = new Map<string, PendingTile>();
const rowTables = new Map<string, RowBinTable>();

// -- Functions -----------------------------------------------------------------

function rowTableFor(view: TileView, heightPx: number): RowBinTable {
  const { spectrumScale, spectrumTop } = view.look;
  const { fftSize, sampleRate } = view.session;
  const key = `${spectrumScale}|${spectrumTop}|${heightPx}|${fftSize}|${sampleRate}`;
  let table = rowTables.get(key);
  if (table) return table;
  if (rowTables.size >= MAX_ROW_TABLES) rowTables.clear();
  table = rowBinTable(spectrumScale, spectrumTop, heightPx, fftSize, sampleRate);
  rowTables.set(key, table);
  return table;
}

// Incomplete tiles stay out of the cache; they are reused only until the next chunk lands.
function tileAt(
  view: TileView,
  index: number,
  budget: TileBudget,
): { canvas: OffscreenCanvas; complete: boolean } | null {
  const heightPx = Math.round(view.heightCss * view.pixelRatio);
  const key = tileKey({
    analysisGeneration: view.session.generation,
    pixelsPerSecond: view.pixelsPerSecond,
    height: heightPx,
    scale: view.look.spectrumScale,
    top: view.look.spectrumTop,
    palette: view.look.spectrumPalette,
    phase: view.look.spectrumPhase,
    contrastDb: view.look.spectrumContrast,
    themeGeneration: view.themeGeneration,
    index,
  });
  const cached = tiles.get(key);
  if (cached) return { canvas: cached, complete: true };
  const pending = pendingTiles.get(key);
  if (pending && pending.readyChunks === view.session.readyChunks) return { canvas: pending.canvas, complete: false };
  if (budget.remaining <= 0) return pending ? { canvas: pending.canvas, complete: false } : null;
  budget.remaining--;
  const rendered = renderTile({
    session: view.session,
    table: rowTableFor(view, heightPx),
    lookup: view.lookup,
    palette: view.look.spectrumPalette,
    phase: view.look.spectrumPhase,
    contrastDb: view.look.spectrumContrast,
    pixelsPerSecond: view.pixelsPerSecond,
    pixelRatio: view.pixelRatio,
    heightPx,
    index,
  });
  if (rendered.complete) {
    pendingTiles.delete(key);
    tiles.set(key, rendered.canvas, rendered.bytes);
  } else {
    if (pendingTiles.size >= MAX_PENDING_TILES) pendingTiles.clear();
    pendingTiles.set(key, { canvas: rendered.canvas, readyChunks: view.session.readyChunks });
  }
  return { canvas: rendered.canvas, complete: rendered.complete };
}

function drawTiles(
  context: CanvasRenderingContext2D,
  view: TileView,
  blit: TileBlit,
  onResolved?: (complete: readonly number[], incomplete: readonly number[]) => void,
): DrawResult {
  context.clearRect(0, 0, view.viewportWidth, view.heightCss);
  const { first, last } = visibleTileRange(view.scrollLeft, view.viewportWidth);
  const budget: TileBudget = { remaining: TILE_BUILD_BUDGET };
  const resolved: { index: number; canvas: OffscreenCanvas }[] = [];
  const complete: number[] = [];
  const incomplete: number[] = [];
  let settled = true;
  for (let index = first; index <= last; index++) {
    const tile = tileAt(view, index, budget);
    if (!tile) {
      settled = false;
      continue;
    }
    if (tile.complete) complete.push(index);
    else incomplete.push(index);
    resolved.push({ index, canvas: tile.canvas });
  }
  onResolved?.(complete, incomplete);
  let animating = false;
  for (const { index, canvas } of resolved) {
    const x = Math.round((index * TILE_WIDTH - view.scrollLeft) * view.pixelRatio) / view.pixelRatio;
    if (blit(context, canvas, index, x)) animating = true;
  }
  return { settled: settled && incomplete.length === 0, animating };
}

// -- Exports -------------------------------------------------------------------

export { drawTiles };
export type { TileView };
