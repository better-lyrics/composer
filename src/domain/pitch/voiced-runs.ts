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

function backgroundLaneRuns(runs: readonly PitchPoint[][], leadSpans: readonly Bounds[]): PitchPoint[][] {
  return runs
    .map((run) =>
      run.filter((point) => !leadSpans.some((span) => point.seconds >= span.begin && point.seconds < span.end)),
    )
    .filter((run) => run.length >= MIN_RUN_POINTS);
}

// -- Exports ------------------------------------------------------------------

export { backgroundLaneRuns, voicedRuns };
