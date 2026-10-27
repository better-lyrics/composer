// -- Types --------------------------------------------------------------------

interface ScrubVoiceState {
  position: number;
}

type ScrubStep = { kind: "start"; rate: number } | { kind: "steer"; rate: number } | { kind: "clip" };

// -- Constants ----------------------------------------------------------------

const SCRUB_JUMP_S = 0.15;
const REVERSAL_TOLERANCE_S = 0.002;
const MIN_VOICE_RATE = 0.05;
const MAX_VOICE_RATE = 4;
// Rate added per second of drift, so the voice closes a gap to the playhead in about 250 ms.
const DRIFT_GAIN = 4;

// -- Functions ----------------------------------------------------------------

function clampRate(rate: number): number {
  return Math.min(MAX_VOICE_RATE, Math.max(MIN_VOICE_RATE, rate));
}

function scrubStep(voice: ScrubVoiceState | null, time: number, previousTime: number, speed: number): ScrubStep {
  if (time < previousTime - REVERSAL_TOLERANCE_S) return { kind: "clip" };
  const start: ScrubStep = { kind: "start", rate: clampRate(speed) };
  if (!voice) return start;
  const drift = time - voice.position;
  if (Math.abs(drift) > SCRUB_JUMP_S) return start;
  const corrected = speed + DRIFT_GAIN * drift;
  // Ahead of the playhead with the rate already at the floor, the voice would take seconds to fall back in line.
  if (drift < 0 && corrected < MIN_VOICE_RATE) return start;
  return { kind: "steer", rate: clampRate(corrected) };
}

// -- Exports ------------------------------------------------------------------

export { SCRUB_JUMP_S, scrubStep };
