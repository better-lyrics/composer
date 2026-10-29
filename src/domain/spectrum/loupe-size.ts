// -- Types --------------------------------------------------------------------

interface LoupeSize {
  width: number;
  height: number;
}

type LoupeResizeAxis = "x" | "y" | "xy";

interface AxisRange {
  min: number;
  default: number;
  max: number;
}

// -- Constants ----------------------------------------------------------------

const LOUPE_SIZE = {
  width: { min: 320, default: 428, max: 720 },
  height: { min: 96, default: 124, max: 400 },
  step: 4,
} as const;

// The ruler and word lanes under the spectrum, and the card's padding and header.
const LOUPE_FIXED = { rulerHeight: 18, lanesHeight: 60, cardX: 12, cardY: 38 } as const;
const VIEWPORT_MARGIN = 32;

// -- Functions ----------------------------------------------------------------

function clampAxis(value: number, range: AxisRange): number {
  if (!Number.isFinite(value)) return range.default;
  const snapped = Math.round(value / LOUPE_SIZE.step) * LOUPE_SIZE.step;
  return Math.min(range.max, Math.max(range.min, snapped));
}

function floorToStep(value: number): number {
  return Math.floor(value / LOUPE_SIZE.step) * LOUPE_SIZE.step;
}

function clampLoupeSize(size: LoupeSize): LoupeSize {
  return { width: clampAxis(size.width, LOUPE_SIZE.width), height: clampAxis(size.height, LOUPE_SIZE.height) };
}

function fitLoupeSize(size: LoupeSize, viewport: LoupeSize, reservedHeight = 0): LoupeSize {
  const roomWidth = viewport.width - 2 * VIEWPORT_MARGIN - LOUPE_FIXED.cardX;
  const roomHeight =
    viewport.height -
    2 * VIEWPORT_MARGIN -
    reservedHeight -
    LOUPE_FIXED.rulerHeight -
    LOUPE_FIXED.lanesHeight -
    LOUPE_FIXED.cardY;
  return {
    width: Math.max(LOUPE_SIZE.width.min, Math.min(size.width, floorToStep(roomWidth))),
    height: Math.max(LOUPE_SIZE.height.min, Math.min(size.height, floorToStep(roomHeight))),
  };
}

function resizedLoupe(
  start: LoupeSize,
  delta: { x: number; y: number },
  axis: LoupeResizeAxis,
  limits: LoupeSize,
): LoupeSize {
  const next = clampLoupeSize({
    width: axis === "y" ? start.width : start.width + 2 * delta.x,
    height: axis === "x" ? start.height : start.height + delta.y,
  });
  return { width: Math.min(next.width, limits.width), height: Math.min(next.height, limits.height) };
}

function isDefaultLoupeSize(size: LoupeSize): boolean {
  return size.width === LOUPE_SIZE.width.default && size.height === LOUPE_SIZE.height.default;
}

// -- Exports ------------------------------------------------------------------

export { LOUPE_FIXED, LOUPE_SIZE, clampLoupeSize, fitLoupeSize, isDefaultLoupeSize, resizedLoupe };
export type { LoupeResizeAxis, LoupeSize };
