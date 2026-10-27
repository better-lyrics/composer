// -- Types --------------------------------------------------------------------

interface ScrubVoiceState {
  position: number;
}

type ScrubStep = { kind: "start" } | { kind: "steer"; rate: number } | { kind: "clip" };

// -- Constants ----------------------------------------------------------------

const SCRUB_JUMP_S = 0.15;
const MIN_VOICE_RATE = 0.05;
const MAX_VOICE_RATE = 4;
// Rate added per second of drift, so the voice closes a gap to the playhead in about 250 ms.
const DRIFT_GAIN = 4;

// -- Functions ----------------------------------------------------------------

function scrubStep(voice: ScrubVoiceState | null, time: number, previousTime: number, speed: number): ScrubStep {
  if (time < previousTime) return { kind: "clip" };
  if (!voice) return { kind: "start" };
  const drift = time - voice.position;
  if (Math.abs(drift) > SCRUB_JUMP_S) return { kind: "start" };
  const rate = Math.min(MAX_VOICE_RATE, Math.max(MIN_VOICE_RATE, speed + DRIFT_GAIN * drift));
  return { kind: "steer", rate };
}

// -- Exports ------------------------------------------------------------------

export { MAX_VOICE_RATE, MIN_VOICE_RATE, SCRUB_JUMP_S, scrubStep };
export type { ScrubStep, ScrubVoiceState };
