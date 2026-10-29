import { CHUNK_FRAMES } from "@/domain/spectrum/chunk-order";
import { ByteLru } from "@/domain/spectrum/byte-lru";
import { type RowBinTable, rowBinTable } from "@/domain/spectrum/frequency-scale";
import type { PaletteLookup } from "@/domain/spectrum/palettes";
import type { SpectrumLook } from "@/domain/spectrum/settings";
import { TILE_WIDTH, tileKey, visibleTileRange } from "@/domain/spectrum/tile-key";
import { renderTile } from "@/views/timeline/spectrum/render-tile";
import { requestSpectrumRawPhase } from "@/views/timeline/spectrum/use-spectrum-session";
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
  deadline: number;
  built: number;
}

interface RefineDraw {
  deadline: number;
  underlay: (context: CanvasRenderingContext2D) => void;
}

interface PendingTile {
  canvas: OffscreenCanvas;
  progress: number;
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
let tilesGeneration = -1;

// -- Functions -----------------------------------------------------------------

const requestedRawChunks = { generation: -1, chunks: new Set<number>() };

// Raw phase is computed on demand, for every chunk the drawn tiles cover, offscreen parts included.
function requestRawPhaseForTiles(view: TileView, first: number, last: number): void {
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
  const lastChunk = Math.min(chunkAt((last + 1) * TILE_WIDTH), (session.chunkReady?.length ?? 0) - 1);
  for (let chunk = chunkAt(first * TILE_WIDTH); chunk <= lastChunk; chunk++) {
    if (requestedRawChunks.chunks.has(chunk) || session.rawReady?.[chunk] === 1) continue;
    wanted.push(chunk);
  }
  if (wanted.length > 0 && requestSpectrumRawPhase(wanted)) {
    for (const chunk of wanted) requestedRawChunks.chunks.add(chunk);
  }
}

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

function tileProgress(session: TileView["session"]): number {
  return session.readyChunks + session.rawChunks;
}

// Incomplete tiles stay out of the cache; they are reused only until the next chunk lands.
function tileAt(
  view: TileView,
  index: number,
  budget: TileBudget,
): { canvas: OffscreenCanvas; complete: boolean } | null {
  // Tiles of an earlier analysis can never be drawn again.
  if (view.session.generation !== tilesGeneration) {
    tilesGeneration = view.session.generation;
    tiles.clear();
    pendingTiles.clear();
  }
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
  if (pending && pending.progress === tileProgress(view.session)) return { canvas: pending.canvas, complete: false };
  const overTime = budget.built > 0 && performance.now() >= budget.deadline;
  if (budget.remaining <= 0 || overTime) return pending ? { canvas: pending.canvas, complete: false } : null;
  budget.remaining--;
  budget.built++;
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
    pendingTiles.set(key, { canvas: rendered.canvas, progress: tileProgress(view.session) });
  }
  return { canvas: rendered.canvas, complete: rendered.complete };
}

function buildOrder(first: number, last: number, centreFirst: boolean): number[] {
  const indices = Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
  if (!centreFirst) return indices;
  const centre = (first + last) / 2;
  return indices.toSorted((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
}

function drawTiles(
  context: CanvasRenderingContext2D,
  view: TileView,
  blit: TileBlit,
  onResolved?: (complete: readonly number[], incomplete: readonly number[]) => void,
  refine?: RefineDraw,
): DrawResult {
  context.clearRect(0, 0, view.viewportWidth, view.heightCss);
  refine?.underlay(context);
  const { first, last } = visibleTileRange(view.scrollLeft, view.viewportWidth);
  requestRawPhaseForTiles(view, first, last);
  const budget: TileBudget = {
    remaining: TILE_BUILD_BUDGET,
    deadline: refine?.deadline ?? Number.POSITIVE_INFINITY,
    built: 0,
  };
  const resolved: { index: number; canvas: OffscreenCanvas }[] = [];
  const complete: number[] = [];
  const incomplete: number[] = [];
  let settled = true;
  for (const index of buildOrder(first, last, refine !== undefined)) {
    const tile = tileAt(view, index, budget);
    if (!tile) {
      settled = false;
      continue;
    }
    if (tile.complete) complete.push(index);
    else incomplete.push(index);
    resolved.push({ index, canvas: tile.canvas });
  }
  const ascending = (a: number, b: number) => a - b;
  onResolved?.(refine ? complete.toSorted(ascending) : complete, refine ? incomplete.toSorted(ascending) : incomplete);
  let animating = false;
  for (const { index, canvas } of resolved) {
    const x = Math.round((index * TILE_WIDTH - view.scrollLeft) * view.pixelRatio) / view.pixelRatio;
    if (blit(context, canvas, index, x)) animating = true;
  }
  return { settled: settled && incomplete.length === 0, animating };
}

// -- Exports -------------------------------------------------------------------

export type { RefineDraw, TileView };
export { drawTiles };
