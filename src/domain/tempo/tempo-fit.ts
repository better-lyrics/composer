import { roundBeatTime } from "@/domain/tempo/beat-grid";

// -- Types ---------------------------------------------------------------------

interface CountedBeat {
  time: number;
  step: number;
}

interface Line {
  start: number;
  period: number;
}

// -- Constants -----------------------------------------------------------------

const FIT_TOLERANCE_SECONDS = 0.035;
const MIN_SECTION_BEATS = 8;
const STEADY_INLIER_SECONDS = 0.06;
const STEADY_INLIER_SHARE = 0.9;
const STEADY_FIT_ROUNDS = 4;
const PERIOD_SEARCH = 0.04;
const PERIOD_SEARCH_STEP = 0.0002;

// -- Helpers -------------------------------------------------------------------

function lineThrough(beats: readonly CountedBeat[], from: number, to: number): Line {
  const count = to - from + 1;
  let meanStep = 0;
  let meanTime = 0;
  for (let i = from; i <= to; i++) {
    meanStep += beats[i].step / count;
    meanTime += beats[i].time / count;
  }
  let covariance = 0;
  let variance = 0;
  for (let i = from; i <= to; i++) {
    covariance += (beats[i].step - meanStep) * (beats[i].time - meanTime);
    variance += (beats[i].step - meanStep) ** 2;
  }
  const period = covariance / variance;
  return { start: meanTime - meanStep * period, period };
}

function fits(beats: readonly CountedBeat[], from: number, to: number, line: Line): boolean {
  for (let i = from; i <= to; i++) {
    if (Math.abs(line.start + beats[i].step * line.period - beats[i].time) > FIT_TOLERANCE_SECONDS) return false;
  }
  return true;
}

function sectionEnd(beats: readonly CountedBeat[], from: number): number {
  let end = Math.min(beats.length - 1, from + MIN_SECTION_BEATS - 1);
  if (!fits(beats, from, end, lineThrough(beats, from, end))) return -1;
  while (end + 1 < beats.length && fits(beats, from, end + 1, lineThrough(beats, from, end + 1))) end++;
  return end;
}

// -- Fit -----------------------------------------------------------------------

function evenTempoBeats(beats: readonly CountedBeat[]): Map<number, number> {
  const times = new Map<number, number>();
  let from = 0;
  while (from < beats.length) {
    const end = beats.length - from >= MIN_SECTION_BEATS ? sectionEnd(beats, from) : -1;
    if (end < 0) {
      times.set(beats[from].step, beats[from].time);
      from++;
      continue;
    }
    const line = lineThrough(beats, from, end);
    for (let step = beats[from].step; step <= beats[end].step; step++) {
      times.set(step, roundBeatTime(line.start + step * line.period));
    }
    from = end === beats.length - 1 ? end + 1 : end;
  }
  return times;
}

// -- Steady tempo --------------------------------------------------------------

function phaseOf(times: readonly number[], period: number): number {
  let x = 0;
  let y = 0;
  for (const time of times) {
    x += Math.cos((2 * Math.PI * time) / period);
    y += Math.sin((2 * Math.PI * time) / period);
  }
  return ((Math.atan2(y, x) / (2 * Math.PI) + 1) % 1) * period;
}

function inliersOf(times: readonly number[], line: Line): CountedBeat[] {
  return times.flatMap((time) => {
    const step = Math.round((time - line.start) / line.period);
    return Math.abs(line.start + step * line.period - time) <= STEADY_INLIER_SECONDS ? [{ time, step }] : [];
  });
}

function bestPeriod(times: readonly number[], songPeriod: number): Line {
  let best: Line = { start: phaseOf(times, songPeriod), period: songPeriod };
  let bestCount = -1;
  for (let ratio = -PERIOD_SEARCH; ratio <= PERIOD_SEARCH; ratio += PERIOD_SEARCH_STEP) {
    const period = songPeriod * (1 + ratio);
    const line = { start: phaseOf(times, period), period };
    const count = inliersOf(times, line).length;
    if (count > bestCount) {
      best = line;
      bestCount = count;
    }
  }
  return best;
}

function steadyLine(times: readonly number[], songPeriod: number): Line | null {
  let line = bestPeriod(times, songPeriod);
  for (let round = 0; round < STEADY_FIT_ROUNDS; round++) {
    const inliers = inliersOf(times, line);
    if (inliers.length < MIN_SECTION_BEATS) return null;
    line = lineThrough(inliers, 0, inliers.length - 1);
  }
  return inliersOf(times, line).length >= times.length * STEADY_INLIER_SHARE ? line : null;
}

function stepAt(line: Line, time: number): number {
  return Math.round((time - line.start) / line.period);
}

function steadyBeats(line: Line, from: number, to: number): Map<number, number> {
  const times = new Map<number, number>();
  const first = Math.max(stepAt(line, from), Math.ceil(-line.start / line.period));
  for (let step = first; step <= stepAt(line, to); step++) {
    times.set(step, roundBeatTime(line.start + step * line.period));
  }
  return times;
}

// -- Exports -------------------------------------------------------------------

export { evenTempoBeats, stepAt, steadyBeats, steadyLine };
export type { CountedBeat };
