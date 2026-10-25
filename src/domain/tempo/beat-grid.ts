// -- Types ---------------------------------------------------------------------

type BeatGridSource = "detected" | "manual";

interface DetectedBeats {
  beats: number[];
  downbeats: number[];
}

interface ManualTempo {
  bpm: number;
  beatsPerBar: number;
  anchor: number;
}

interface BeatGrid {
  source: BeatGridSource;
  beats: number[];
  downbeatIndices: number[];
  beatsPerBar: number;
  offsetMs: number;
  tempoScale: number;
  origin: DetectedBeats | ManualTempo;
}

// -- Constants -----------------------------------------------------------------

const DOWNBEAT_MATCH_SECONDS = 0.03;
const DEFAULT_BEATS_PER_BAR = 4;
const BEAT_TOLERANCE_SECONDS = 0.001;

// -- Grid ----------------------------------------------------------------------

function mostCommonBarLength(downbeatIndices: readonly number[]): number {
  const counts = new Map<number, number>();
  for (let i = 1; i < downbeatIndices.length; i++) {
    const length = downbeatIndices[i] - downbeatIndices[i - 1];
    counts.set(length, (counts.get(length) ?? 0) + 1);
  }
  let best = DEFAULT_BEATS_PER_BAR;
  let bestCount = 0;
  for (const [length, count] of counts) {
    if (count > bestCount) {
      best = length;
      bestCount = count;
    }
  }
  return best;
}

function nearestBeatIndex(beats: readonly number[], time: number, from: number): number {
  let index = from;
  while (index < beats.length - 1 && beats[index + 1] <= time) index++;
  const next = index + 1;
  if (next < beats.length && beats[next] - time < time - beats[index]) return next;
  return index;
}

function detectedGrid(detection: DetectedBeats): BeatGrid {
  const beats = detection.beats.slice();
  const downbeatIndices: number[] = [];
  let cursor = 0;
  for (const downbeat of detection.downbeats) {
    if (beats.length === 0) break;
    cursor = nearestBeatIndex(beats, downbeat, cursor);
    const isMatch = Math.abs(beats[cursor] - downbeat) < DOWNBEAT_MATCH_SECONDS;
    if (isMatch && downbeatIndices.at(-1) !== cursor) downbeatIndices.push(cursor);
  }
  return {
    source: "detected",
    beats,
    downbeatIndices,
    beatsPerBar: mostCommonBarLength(downbeatIndices),
    offsetMs: 0,
    tempoScale: 1,
    origin: { beats: detection.beats.slice(), downbeats: detection.downbeats.slice() },
  };
}

function beatTime(grid: BeatGrid, index: number): number {
  return grid.beats[index] + grid.offsetMs / 1000;
}

function beatIndexAt(grid: BeatGrid, time: number): number {
  let lo = 0;
  let hi = grid.beats.length - 1;
  const reach = time + BEAT_TOLERANCE_SECONDS;
  if (hi < 0 || reach < beatTime(grid, 0)) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (beatTime(grid, mid) <= reach) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function downbeatsUpTo(grid: BeatGrid, index: number): number {
  let lo = 0;
  let hi = grid.downbeatIndices.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (grid.downbeatIndices[mid] <= index) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function barNumberAt(grid: BeatGrid, index: number): number {
  return downbeatsUpTo(grid, index);
}

function beatInBar(grid: BeatGrid, index: number): number {
  const bar = downbeatsUpTo(grid, index);
  return bar > 0 ? index - grid.downbeatIndices[bar - 1] : index;
}

function isDownbeat(grid: BeatGrid, index: number): boolean {
  return downbeatsUpTo(grid, index) > downbeatsUpTo(grid, index - 1);
}

// -- Exports -------------------------------------------------------------------

export { barNumberAt, beatInBar, beatIndexAt, beatTime, detectedGrid, isDownbeat };
export type { BeatGrid, BeatGridSource, DetectedBeats, ManualTempo };
