// -- Functions -----------------------------------------------------------------

function snapTimeToOnset(time: number, onsets: number[], zoom: number, thresholdPx: number): number {
  let best = time;
  let bestDistPx = thresholdPx;
  for (const onset of onsets) {
    const distPx = Math.abs(onset - time) * zoom;
    if (distPx <= bestDistPx) {
      bestDistPx = distPx;
      best = onset;
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

export { snapTimeToOnset, isTimeOnOnset, computeCoveredOnsets, adjacentSnapPoint };
