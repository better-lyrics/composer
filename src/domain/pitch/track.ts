// -- Types --------------------------------------------------------------------

interface PitchTrack {
  hopSeconds: number;
  startSeconds: number;
  frequencyHz: Float32Array;
  confidencePercent: Uint8Array;
  loudnessDb: Int16Array;
}

interface PitchPoint {
  seconds: number;
  semitones: number;
}

// -- Constants ----------------------------------------------------------------

const VOICED_CONFIDENCE_PERCENT = 50;
const VOICED_LOUDNESS_DB = -45;

// -- Functions ----------------------------------------------------------------

function isVoicedFrame(track: PitchTrack, frame: number): boolean {
  return (
    track.confidencePercent[frame] >= VOICED_CONFIDENCE_PERCENT &&
    track.loudnessDb[frame] > VOICED_LOUDNESS_DB &&
    track.frequencyHz[frame] > 0
  );
}

function frameTime(track: PitchTrack, frame: number): number {
  return track.startSeconds + frame * track.hopSeconds;
}

function frameAt(track: PitchTrack, seconds: number): number {
  return Math.floor((seconds - track.startSeconds) / track.hopSeconds);
}

function semitonesOf(hz: number): number {
  return 12 * Math.log2(hz / 55);
}

// -- Exports ------------------------------------------------------------------

export { frameAt, frameTime, isVoicedFrame, semitonesOf };
export type { PitchPoint, PitchTrack };
