const MAX_TAP_SYNC_SNAP_SECONDS = 0.12;
const MIN_TAP_SYNC_SNAP_SECONDS = 0.02;

interface VocalSnapResult {
  time: number;
  snapped: boolean;
}

function getTapSyncSnapThresholdSeconds(zoom: number, thresholdPx: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return MAX_TAP_SYNC_SNAP_SECONDS;
  if (!Number.isFinite(thresholdPx) || thresholdPx <= 0) return MIN_TAP_SYNC_SNAP_SECONDS;
  return Math.max(MIN_TAP_SYNC_SNAP_SECONDS, Math.min(MAX_TAP_SYNC_SNAP_SECONDS, thresholdPx / zoom));
}

function findNearestVocalOnset(time: number, onsets: number[]): number | null {
  if (!Number.isFinite(time) || onsets.length === 0) return null;

  let lo = 0;
  let hi = onsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (onsets[mid] < time) lo = mid + 1;
    else hi = mid;
  }

  let best: number | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const candidate of [onsets[lo - 1], onsets[lo]]) {
    if (!Number.isFinite(candidate)) continue;
    const delta = Math.abs(candidate - time);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

function resolveVocalOnsetSnap(time: number, onsets: number[], thresholdSeconds: number): VocalSnapResult {
  const nearest = findNearestVocalOnset(time, onsets);
  if (nearest === null) return { time, snapped: false };
  if (Math.abs(nearest - time) > thresholdSeconds) return { time, snapped: false };
  return { time: nearest, snapped: true };
}

export { findNearestVocalOnset, getTapSyncSnapThresholdSeconds, resolveVocalOnsetSnap };
export type { VocalSnapResult };
