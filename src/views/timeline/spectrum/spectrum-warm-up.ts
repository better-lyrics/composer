import { TILE_WIDTH } from "@/domain/spectrum/tile-key";

// -- Interfaces ----------------------------------------------------------------

interface WarmUp {
  generation: number;
  reducedMotion: boolean;
  starts: Map<number, number>;
  pendingSeen: Set<number>;
}

// -- Constants -----------------------------------------------------------------

const WARM_MS = 360;
const WARM_REDUCED_MS = 150;
const WARM_STAGGER_MS = 45;
const WARM_SHOW_DELAY_MS = 120;
const FLASH_END = 0.45;

// -- Functions -----------------------------------------------------------------

function createWarmUp(): WarmUp {
  return { generation: -1, reducedMotion: false, starts: new Map(), pendingSeen: new Set() };
}

function scheduleFromCentre(warmUp: WarmUp, indices: readonly number[], firstStart: number): void {
  if (indices.length === 0) return;
  const centre = (Math.min(...indices) + Math.max(...indices)) / 2;
  const stagger = warmUp.reducedMotion ? 0 : WARM_STAGGER_MS;
  indices
    .toSorted((a, b) => Math.abs(a - centre) - Math.abs(b - centre))
    .forEach((index, rank) => warmUp.starts.set(index, firstStart + rank * stagger));
}

// Every visible tile powers on together when the spectrum appears or its analysis starts over.
function beginWarmUp(warmUp: WarmUp, visible: readonly number[], generation: number, now: number): void {
  warmUp.generation = generation;
  warmUp.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  warmUp.starts.clear();
  warmUp.pendingSeen.clear();
  scheduleFromCentre(warmUp, visible, now + (warmUp.reducedMotion ? 0 : WARM_SHOW_DELAY_MS));
}

function isWarming(warmUp: WarmUp, generation: number, now: number): boolean {
  if (warmUp.generation !== generation) return true;
  const duration = warmUp.reducedMotion ? WARM_REDUCED_MS : WARM_MS;
  for (const start of warmUp.starts.values()) if (now - start < duration) return true;
  return false;
}

// A tile first drawn as a placeholder powers on once its analysis lands.
function noteDrawnTiles(warmUp: WarmUp, complete: readonly number[], incomplete: readonly number[], now: number): void {
  for (const index of incomplete) warmUp.pendingSeen.add(index);
  const arrived = complete.filter((index) => warmUp.pendingSeen.delete(index));
  scheduleFromCentre(warmUp, arrived, now);
}

function blitWarming(
  warmUp: WarmUp,
  context: CanvasRenderingContext2D,
  tile: OffscreenCanvas,
  index: number,
  x: number,
  height: number,
  now: number,
): boolean {
  const start = warmUp.starts.get(index);
  const progress = start === undefined ? 1 : (now - start) / (warmUp.reducedMotion ? WARM_REDUCED_MS : WARM_MS);
  if (progress >= 1) {
    warmUp.starts.delete(index);
    context.drawImage(tile, x, 0, TILE_WIDTH, height);
    return false;
  }
  if (progress < 0) return true;
  context.save();
  if (warmUp.reducedMotion) {
    context.globalAlpha = 1 - (1 - progress) ** 3;
  } else if (progress < FLASH_END) {
    const rise = progress / FLASH_END;
    context.globalAlpha = rise;
    context.filter = `brightness(${0.2 + 1.25 * rise}) saturate(${0.4 + 0.8 * rise})`;
  } else {
    const settle = 1 - (1 - (progress - FLASH_END) / (1 - FLASH_END)) ** 2;
    context.filter = `brightness(${1.45 - 0.45 * settle}) saturate(${1.2 - 0.2 * settle})`;
  }
  context.drawImage(tile, x, 0, TILE_WIDTH, height);
  context.restore();
  return true;
}

// -- Exports -------------------------------------------------------------------

export { beginWarmUp, blitWarming, createWarmUp, isWarming, noteDrawnTiles };
