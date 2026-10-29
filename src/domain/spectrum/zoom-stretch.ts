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

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function fadeInAlpha(elapsedMs: number, durationMs: number): number {
  if (elapsedMs >= durationMs) return 1;
  return easeOutCubic(Math.max(0, elapsedMs) / durationMs);
}

// -- Exports -------------------------------------------------------------------

export { easeOutCubic, fadeInAlpha, stretchedBaseRect };
export type { StretchSource };
