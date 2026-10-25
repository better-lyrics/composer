import { type DetectedBeats, detectedGrid, roundBeatTime } from "@/domain/tempo/beat-grid";
import { beatIntervals, median } from "@/domain/tempo/beat-intervals";
import { type CountedBeat, evenTempoBeats } from "@/domain/tempo/tempo-fit";

// Peak picking hears off-beats and misses quiet beats. A beat tracker over the peaks
// (Ellis 2007 dynamic programming) keeps the chain that best follows the local tempo.

// -- Constants -----------------------------------------------------------------

const MIN_BEATS = 3;
const PERIOD_RADIUS = 8;
const TEMPO_WEIGHT = 4;
const MISSED_BEAT_COST = 0.6;
const RESTART_COST = 2;
const MAX_BEATS_PER_STEP = 4;
const DOWNBEAT_REACH = 0.25;

// -- Helpers -------------------------------------------------------------------

function localPeriods(beats: readonly number[]): number[] {
  const intervals = beatIntervals(beats);
  return beats.map((_, i) =>
    median(intervals.slice(Math.max(0, i - PERIOD_RADIUS), Math.min(intervals.length, i + PERIOD_RADIUS))),
  );
}

function stepCost(gap: number, period: number): number {
  const steps = Math.max(1, Math.round(gap / period));
  return TEMPO_WEIGHT * Math.log(gap / (steps * period)) ** 2 + MISSED_BEAT_COST * (steps - 1);
}

// -- Beats ---------------------------------------------------------------------

function trackedPeaks(beats: readonly number[], periods: readonly number[]): number[] {
  const score: number[] = [];
  const previous: number[] = [];
  let far = 0;
  let farBest = -1;
  for (let j = 0; j < beats.length; j++) {
    const reach = (MAX_BEATS_PER_STEP + 0.5) * periods[j];
    for (; far < j && beats[j] - beats[far] > reach; far++) {
      if (farBest < 0 || score[far] > score[farBest]) farBest = far;
    }
    let best = farBest >= 0 ? Math.max(0, score[farBest] - RESTART_COST) : 0;
    let from = best > 0 ? farBest : -1;
    for (let i = far; i < j; i++) {
      const candidate = score[i] - stepCost(beats[j] - beats[i], periods[j]);
      if (candidate > best) {
        best = candidate;
        from = i;
      }
    }
    score.push(1 + best);
    previous.push(from);
  }
  let end = 0;
  for (let j = 1; j < beats.length; j++) if (score[j] >= score[end]) end = j;
  const kept: number[] = [];
  for (let j = end; j >= 0; j = previous[j]) kept.push(j);
  return kept.reverse();
}

function filledBeats(beats: readonly number[]): number[] {
  const periods = localPeriods(beats);
  const kept = trackedPeaks(beats, periods);
  const filled: number[] = [];
  kept.forEach((index, k) => {
    filled.push(beats[index]);
    const next = kept[k + 1];
    if (next === undefined) return;
    const gap = beats[next] - beats[index];
    const steps = Math.round(gap / periods[index]);
    if (steps > MAX_BEATS_PER_STEP) return;
    for (let part = 1; part < steps; part++) filled.push(roundBeatTime(beats[index] + (gap * part) / steps));
  });
  return filled;
}

// -- Bars ----------------------------------------------------------------------

function snappedDownbeats(beats: readonly number[], downbeats: readonly number[]): number[] {
  const periods = localPeriods(beats);
  const indices: number[] = [];
  let cursor = 0;
  for (const downbeat of downbeats) {
    while (cursor < beats.length - 1 && Math.abs(beats[cursor + 1] - downbeat) <= Math.abs(beats[cursor] - downbeat)) {
      cursor++;
    }
    const near = Math.abs(beats[cursor] - downbeat) <= DOWNBEAT_REACH * periods[cursor];
    if (near && indices.at(-1) !== cursor) indices.push(cursor);
  }
  return indices;
}

function evenBars(from: number, to: number, beatsPerBar: number): number[] {
  const bars: number[] = [];
  for (let index = from + beatsPerBar; index <= to; index += beatsPerBar) bars.push(index);
  return bars;
}

function repairedBars(indices: readonly number[], beatsPerBar: number): number[] {
  if (indices.length === 0) return [];
  const repaired = [indices[0]];
  for (let i = 1; i < indices.length; i++) {
    const last = repaired[repaired.length - 1];
    const length = indices[i] - last;
    const nextLength = (indices[i + 1] ?? Number.NaN) - last;
    if (length !== beatsPerBar && length % beatsPerBar === 0) {
      repaired.push(...evenBars(last, indices[i], beatsPerBar));
    } else if (length % beatsPerBar !== 0 && nextLength % beatsPerBar === 0) {
      repaired.push(...evenBars(last, indices[i + 1], beatsPerBar));
      i++;
    } else {
      repaired.push(indices[i]);
    }
  }
  return repaired;
}

// -- Counting ------------------------------------------------------------------

function countedBeats(beats: readonly number[]): CountedBeat[] {
  const periods = localPeriods(beats);
  const counted: CountedBeat[] = [];
  beats.forEach((time, i) => {
    const previous = counted.at(-1);
    const step = previous ? previous.step + Math.max(1, Math.round((time - previous.time) / periods[i - 1])) : 0;
    counted.push({ time, step });
  });
  return counted;
}

// -- Regular beats -------------------------------------------------------------

function regularBeats(detection: DetectedBeats): DetectedBeats {
  if (detection.beats.length < MIN_BEATS) return detection;
  const tracked = filledBeats(detection.beats);
  const counted = countedBeats(tracked);
  const barIndices = snappedDownbeats(tracked, detection.downbeats);
  const grid = detectedGrid({ beats: tracked, downbeats: barIndices.map((index) => tracked[index]) });
  const barSteps = new Set(
    repairedBars(
      barIndices.map((index) => counted[index].step),
      grid.beatsPerBar,
    ),
  );
  const even = [...evenTempoBeats(counted)].filter(([, time]) => time >= 0).toSorted(([a], [b]) => a - b);
  return {
    beats: even.map(([, time]) => time),
    downbeats: even.flatMap(([step, time]) => (barSteps.has(step) ? [time] : [])),
  };
}

// -- Exports -------------------------------------------------------------------

export { regularBeats };
