// -- Types --------------------------------------------------------------------

interface ResumeScroll {
  left: number;
  top: number;
}

interface ResumePosition {
  time: number;
  zoom: number;
  scroll?: ResumeScroll;
}

// -- Predicates ---------------------------------------------------------------

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isResumeScroll(value: unknown): value is ResumeScroll {
  if (typeof value !== "object" || value === null) return false;
  const { left, top } = value as Record<string, unknown>;
  return isNonNegativeNumber(left) && isNonNegativeNumber(top);
}

function isResumePosition(value: unknown): value is ResumePosition {
  if (typeof value !== "object" || value === null) return false;
  const { time, zoom, scroll } = value as Record<string, unknown>;
  const validZoom = isNonNegativeNumber(zoom) && zoom > 0;
  return isNonNegativeNumber(time) && validZoom && (scroll === undefined || isResumeScroll(scroll));
}

// -- Exports ------------------------------------------------------------------

export { isResumePosition };
export type { ResumePosition };
