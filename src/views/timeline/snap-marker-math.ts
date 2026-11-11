// -- Types ---------------------------------------------------------------------

interface PointSnapAnchor {
  t: number;
  thresholdPx: number;
}

// -- Functions -----------------------------------------------------------------

function snapTimeToPoints(time: number, points: readonly PointSnapAnchor[], zoom: number): number {
  let best = time;
  let bestDistPx = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distPx = Math.abs(point.t - time) * zoom;
    if (distPx <= point.thresholdPx && distPx <= bestDistPx) {
      bestDistPx = distPx;
      best = point.t;
    }
  }
  return best;
}

function isTimeOnOnset(time: number, onsets: number[], zoom: number, thresholdPx: number): boolean {
  for (const onset of onsets) {
    if (Math.abs(onset - time) * zoom <= thresholdPx) return true;
  }
  return false;
}

function computeCoveredOnsets(
  onsets: number[],
  coveringTimes: number[],
  zoom: number,
  thresholdPx: number,
): Set<number> {
  const covered = new Set<number>();
  for (let onsetIndex = 0; onsetIndex < onsets.length; onsetIndex++) {
    const onset = onsets[onsetIndex];
    for (const covering of coveringTimes) {
      if (Math.abs(covering - onset) * zoom <= thresholdPx) {
        covered.add(onsetIndex);
        break;
      }
    }
  }
  return covered;
}

// Onset lines are mounted a step past each side of the view, so a render landing a frame late never shows a gap.
const ONSET_WINDOW_STEP_PX = 1024;

function onsetWindowStep(scrollLeft: number): number {
  return Math.floor(scrollLeft / ONSET_WINDOW_STEP_PX);
}

// Steps may come from a live and a lagging scroll position; the window covers both.
function onsetIndicesInView(
  onsets: readonly number[],
  zoom: number,
  stepA: number,
  stepB: number,
  viewportWidth: number,
): number[] {
  const start = (Math.min(stepA, stepB) - 1) * ONSET_WINDOW_STEP_PX;
  const end = (Math.max(stepA, stepB) + 2) * ONSET_WINDOW_STEP_PX + viewportWidth;
  const indices: number[] = [];
  for (let index = 0; index < onsets.length; index++) {
    const x = onsets[index] * zoom;
    if (x >= start && x <= end) indices.push(index);
  }
  return indices;
}

const ADJACENT_EPSILON = 1e-4;

function adjacentSnapPoint(points: number[], current: number, direction: 1 | -1): number | null {
  if (direction > 0) {
    for (const point of points) if (point > current + ADJACENT_EPSILON) return point;
    return null;
  }
  for (let index = points.length - 1; index >= 0; index--) {
    if (points[index] < current - ADJACENT_EPSILON) return points[index];
  }
  return null;
}

// -- Exports -------------------------------------------------------------------

export {
  snapTimeToPoints,
  isTimeOnOnset,
  computeCoveredOnsets,
  adjacentSnapPoint,
  onsetIndicesInView,
  onsetWindowStep,
};
export type { PointSnapAnchor };
