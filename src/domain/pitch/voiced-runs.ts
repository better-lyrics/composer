import { type PitchPoint, type PitchTrack, frameAt, frameTime, isVoicedFrame, semitonesOf } from "@/domain/pitch/track";
import type { Bounds } from "@/domain/word/bounds";

// -- Constants ----------------------------------------------------------------

const JUMP_SEMITONES = 5;
const MIN_RUN_POINTS = 3;

// -- Functions ----------------------------------------------------------------

// Runs split on unvoiced frames and on jumps too big to be one sung gesture.
function voicedRuns(track: PitchTrack, fromSeconds: number, toSeconds: number): PitchPoint[][] {
  const runs: PitchPoint[][] = [];
  let run: PitchPoint[] | null = null;
  const first = Math.max(0, frameAt(track, fromSeconds));
  const last = Math.min(track.frequencyHz.length, Math.ceil((toSeconds - track.startSeconds) / track.hopSeconds));
  for (let frame = first; frame < last; frame++) {
    if (!isVoicedFrame(track, frame)) {
      run = null;
      continue;
    }
    const semitones = semitonesOf(track.frequencyHz[frame]);
    if (run && Math.abs(semitones - run[run.length - 1].semitones) > JUMP_SEMITONES) run = null;
    if (!run) {
      run = [];
      runs.push(run);
    }
    run.push({ seconds: frameTime(track, frame) + track.hopSeconds / 2, semitones });
  }
  return runs.filter((points) => points.length >= MIN_RUN_POINTS);
}

// A lead word splits a run, so the ribbon never bridges the pitch it hides.
function backgroundLaneRuns(runs: readonly PitchPoint[][], leadSpans: readonly Bounds[]): PitchPoint[][] {
  const kept: PitchPoint[][] = [];
  for (const run of runs) {
    let piece: PitchPoint[] = [];
    for (const point of run) {
      if (leadSpans.some((span) => point.seconds >= span.begin && point.seconds < span.end)) {
        if (piece.length > 0) kept.push(piece);
        piece = [];
      } else piece.push(point);
    }
    if (piece.length > 0) kept.push(piece);
  }
  return kept.filter((run) => run.length >= MIN_RUN_POINTS);
}

// -- Exports ------------------------------------------------------------------

export { backgroundLaneRuns, voicedRuns };
