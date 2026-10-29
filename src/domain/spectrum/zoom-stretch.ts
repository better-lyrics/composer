// -- Interfaces ----------------------------------------------------------------

interface StretchSource {
  pixelsPerSecond: number;
  scrollLeft: number;
  widthCss: number;
}

interface StretchTarget {
  pixelsPerSecond: number;
  scrollLeft: number;
}

// -- Functions -----------------------------------------------------------------

function stretchedBaseRect(source: StretchSource, target: StretchTarget): { x: number; width: number } {
  const scale = target.pixelsPerSecond / source.pixelsPerSecond;
  return { x: source.scrollLeft * scale - target.scrollLeft, width: source.widthCss * scale };
}

function refineAlpha(elapsedMs: number, durationMs: number): number {
  if (elapsedMs >= durationMs) return 1;
  const progress = Math.max(0, elapsedMs) / durationMs;
  return 1 - (1 - progress) ** 3;
}

// -- Exports -------------------------------------------------------------------

export { refineAlpha, stretchedBaseRect };
export type { StretchSource };
