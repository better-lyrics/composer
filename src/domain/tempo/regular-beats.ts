import { type DetectedBeats, detectedGrid, roundBeatTime } from "@/domain/tempo/beat-grid";
import { beatIntervals, median } from "@/domain/tempo/beat-intervals";
import { type CountedBeat, evenTempoBeats, steadyBeats, steadyLine, stepAt } from "@/domain/tempo/tempo-fit";
import { tempoSections } from "@/domain/tempo/tempo-sections";

// Peak picking hears off-beats and misses quiet beats. A beat tracker over the peaks
// (Ellis 2007 dynamic programming) keeps the chain that best follows the local tempo.

// -- Constants -----------------------------------------------------------------

const MIN_BEATS = 3;
const PERIOD_RADIUS = 8;
const MIN_TEMPO_CHANGE_RATIO = 0.6;
const MAX_TEMPO_CHANGE_RATIO = 1.7;
const TEMPO_WEIGHT = 4;
const MISSED_BEAT_COST = 0.6;
const RESTART_COST = 2;
const MAX_BEATS_PER_STEP = 4;
const DOWNBEAT_REACH = 0.25;
const CONFIRMING_BARS = 2;
const HALF_TIME_RATIO_MIN = 1.9;
const HALF_TIME_RATIO_MAX = 2.1;

// -- Helpers -------------------------------------------------------------------

function songPeriod(intervals: readonly number[]): number {
  const sorted = intervals.toSorted((a, b) => a - b);
  const half = sorted.reduce((sum, interval) => sum + interval, 0) / 2;
  let covered = 0;
  for (const interval of sorted) {
    covered += interval;
    if (covered >= half) return interval;
  }
  return sorted[sorted.length - 1];
}

function isTempoChange(period: number, songTempo: number): boolean {
  const ratio = period / songTempo;
  return ratio >= MIN_TEMPO_CHANGE_RATIO && ratio <= MAX_TEMPO_CHANGE_RATIO;
}

function localPeriods(beats: readonly number[]): number[] {
  const intervals = beatIntervals(beats);
  const song = songPeriod(intervals);
  return beats.map((_, i) => {
    const local = median(
      intervals.slice(Math.max(0, i - PERIOD_RADIUS), Math.min(intervals.length, i + PERIOD_RADIUS)),
    );
    return isTempoChange(local, song) ? local : song;
  });
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
  for (let step = from + beatsPerBar; step < to; step += beatsPerBar) bars.push(step);
  return bars;
}

function confirmsPhase(steps: readonly number[], at: number, beatsPerBar: number): boolean {
  const reach = steps[at] + CONFIRMING_BARS * beatsPerBar;
  const following = steps.filter((step) => step > steps[at] && step <= reach);
  const onNewPhase = following.filter((step) => (step - steps[at]) % beatsPerBar === 0);
  return onNewPhase.length >= CONFIRMING_BARS && onNewPhase.length === following.length;
}

function repairedBars(steps: readonly number[], beatsPerBar: number): number[] {
  if (steps.length === 0) return [];
  const bars = [steps[0]];
  for (let i = 1; i < steps.length; i++) {
    const last = bars[bars.length - 1];
    const onPhase = (steps[i] - last) % beatsPerBar === 0;
    if (!onPhase && !confirmsPhase(steps, i, beatsPerBar)) continue;
    bars.push(...evenBars(last, steps[i], beatsPerBar), steps[i]);
  }
  return bars;
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

// -- Steps and bars ------------------------------------------------------------

function stepsAndBars(
  tracked: readonly number[],
  detection: DetectedBeats,
): { steps: Map<number, number>; barSteps: Set<number> } {
  const barIndices = snappedDownbeats(tracked, detection.downbeats);
  const { beatsPerBar } = detectedGrid({ beats: [...tracked], downbeats: barIndices.map((index) => tracked[index]) });
  const steady = steadyLine(tracked, songPeriod(beatIntervals(tracked)));
  if (steady) {
    const steps = steadyBeats(steady, tracked[0], tracked[tracked.length - 1]);
    const bars = barIndices.map((index) => stepAt(steady, tracked[index]));
    return { steps, barSteps: new Set(repairedBars([...new Set(bars)], beatsPerBar)) };
  }
  const counted = countedBeats(tracked);
  const bars = barIndices.map((index) => counted[index].step);
  return { steps: evenTempoBeats(counted), barSteps: new Set(repairedBars(bars, beatsPerBar)) };
}

// -- Half time -----------------------------------------------------------------

function isHalfOf(slow: { bpm: number; seconds: number }, fast: { bpm: number; seconds: number } | undefined): boolean {
  if (!fast || fast.seconds <= slow.seconds) return false;
  const ratio = fast.bpm / slow.bpm;
  return ratio >= HALF_TIME_RATIO_MIN && ratio <= HALF_TIME_RATIO_MAX;
}

function withoutHalfTime(beats: readonly number[], downbeats: readonly number[]): DetectedBeats {
  const grid = detectedGrid({ beats: [...beats], downbeats: [...downbeats] });
  const sections = tempoSections(grid).map((section, i, all) => {
    const to = all[i + 1]?.from ?? beats.length - 1;
    return { ...section, to, seconds: beats[to] - beats[section.from] };
  });
  const isFolded = (i: number) => {
    const at = sections.findIndex((section) => i >= section.from && i < section.to);
    const section = sections[at];
    return section !== undefined && (isHalfOf(section, sections[at - 1]) || isHalfOf(section, sections[at + 1]));
  };
  const bars = new Set(grid.downbeatIndices);
  const folded: number[] = [];
  const foldedDownbeats: number[] = [];
  let barStart = -1;
  const push = (time: number, isBar: boolean, inFold: boolean) => {
    folded.push(time);
    const index = folded.length - 1;
    if (isBar) barStart = index;
    if (isBar || (inFold && barStart >= 0 && (index - barStart) % grid.beatsPerBar === 0)) foldedDownbeats.push(time);
  };
  beats.forEach((time, i) => {
    const foldsAfter = isFolded(i);
    push(time, bars.has(i), foldsAfter || isFolded(i - 1));
    if (foldsAfter) push(roundBeatTime((time + beats[i + 1]) / 2), false, true);
  });
  return { beats: folded, downbeats: foldedDownbeats };
}

// -- Regular beats -------------------------------------------------------------

function regularBeats(detection: DetectedBeats): DetectedBeats {
  if (detection.beats.length < MIN_BEATS) return detection;
  const { steps, barSteps } = stepsAndBars(filledBeats(detection.beats), detection);
  const even = [...steps].filter(([, time]) => time >= 0).toSorted(([a], [b]) => a - b);
  return withoutHalfTime(
    even.map(([, time]) => time),
    even.flatMap(([step, time]) => (barSteps.has(step) ? [time] : [])),
  );
}

// -- Exports -------------------------------------------------------------------

export { regularBeats };
