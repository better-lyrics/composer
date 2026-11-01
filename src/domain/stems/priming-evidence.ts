// -- Constants ----------------------------------------------------------------

const DEFAULT_LAME_PRIMING_FRAMES = 1104;
const DEFAULT_LAME_SOURCE_RATES: readonly number[] = [44_100, 48_000];
const PROBE_AND_RESAMPLE_ROUNDING_FRAMES = 2;

// -- Types --------------------------------------------------------------------

interface StoredStemLength {
  durationSeconds: number;
  sampleRate: number;
  frames: number;
}

// -- Functions ----------------------------------------------------------------

// The probed duration is the full song; the stored WAV lacks what the old build cropped from its decode.
function measuredPrimingFrames(stem: StoredStemLength): number | null {
  const measured = Math.round(stem.durationSeconds * stem.sampleRate) - stem.frames;
  const isDefaultPriming = DEFAULT_LAME_SOURCE_RATES.some(
    (sourceRate) =>
      Math.abs(measured - (DEFAULT_LAME_PRIMING_FRAMES * stem.sampleRate) / sourceRate) <=
      PROBE_AND_RESAMPLE_ROUNDING_FRAMES,
  );
  return isDefaultPriming ? measured : null;
}

// -- Exports ------------------------------------------------------------------

export { measuredPrimingFrames };
