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

// -- Exports -------------------------------------------------------------------

export { snapTimeToOnset, isTimeOnOnset, computeCoveredOnsets };
