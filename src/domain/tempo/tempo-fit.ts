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

// -- Exports -------------------------------------------------------------------

export { evenTempoBeats };
export type { CountedBeat };
