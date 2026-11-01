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

// -- Exports -------------------------------------------------------------------

export { stretchedBaseRect };
export type { StretchSource };
