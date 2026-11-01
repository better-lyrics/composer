import { type PitchTrack, frameAt, isVoicedFrame, semitonesOf } from "@/domain/pitch/track";

// -- Types --------------------------------------------------------------------

interface PitchRange {
  low: number;
  high: number;
}

// -- Constants ----------------------------------------------------------------

const MIN_SPAN_SEMITONES = 6;
const FALLBACK_RANGE: PitchRange = { low: 40, high: 46 };

// -- Functions ----------------------------------------------------------------

// Percentiles keep one cracked note from flattening the rest of the line.
function pitchRangeBetween(track: PitchTrack, beginSeconds: number, endSeconds: number): PitchRange {
  const first = Math.max(0, frameAt(track, beginSeconds));
  const last = Math.min(track.frequencyHz.length, Math.ceil((endSeconds - track.startSeconds) / track.hopSeconds));
  const values: number[] = [];
  for (let frame = first; frame < last; frame++) {
    if (isVoicedFrame(track, frame)) values.push(semitonesOf(track.frequencyHz[frame]));
  }
  if (values.length === 0) return { ...FALLBACK_RANGE };
  values.sort((a, b) => a - b);
  const low = values[Math.floor(values.length * 0.05)];
  const high = values[Math.min(values.length - 1, Math.floor(values.length * 0.95))];
  const centre = (low + high) / 2;
  const span = Math.max(high - low, MIN_SPAN_SEMITONES);
  return { low: centre - span / 2, high: centre + span / 2 };
}

// -- Exports ------------------------------------------------------------------

export { pitchRangeBetween };
export type { PitchRange };
