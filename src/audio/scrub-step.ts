// -- Types --------------------------------------------------------------------

type ScrubStep = { kind: "start"; rate: number } | { kind: "steer"; rate: number } | { kind: "clip" };

// -- Constants ----------------------------------------------------------------

const SCRUB_JUMP_S = 0.15;
const REVERSAL_TOLERANCE_S = 0.002;
const MIN_VOICE_RATE = 0.05;
const MAX_VOICE_RATE = 4;
// Rate added per second of drift, so the voice closes a gap to the playhead in about 250 ms.
const DRIFT_GAIN = 4;
const CLIP: ScrubStep = { kind: "clip" };

// -- Functions ----------------------------------------------------------------

function clampRate(rate: number): number {
  return Math.min(MAX_VOICE_RATE, Math.max(MIN_VOICE_RATE, rate));
}

// `furthestTime` is the furthest point reached since the last reversal, so slow backward moves add up past the tolerance.
function scrubStep(voicePosition: number | null, time: number, furthestTime: number, speed: number): ScrubStep {
  if (time < furthestTime - REVERSAL_TOLERANCE_S) return CLIP;
  if (voicePosition === null) return { kind: "start", rate: clampRate(speed) };
  const drift = time - voicePosition;
  if (Math.abs(drift) > SCRUB_JUMP_S) return { kind: "start", rate: clampRate(speed) };
  const corrected = speed + DRIFT_GAIN * drift;
  // Ahead of the playhead with the rate already at the floor, the voice would take seconds to fall back in line.
  if (drift < 0 && corrected < MIN_VOICE_RATE) return { kind: "start", rate: clampRate(speed) };
  return { kind: "steer", rate: clampRate(corrected) };
}

function furthestTimeAfter(step: ScrubStep, furthestTime: number, time: number): number {
  return step.kind === "clip" ? time : Math.max(furthestTime, time);
}

// -- Exports ------------------------------------------------------------------

export { SCRUB_JUMP_S, furthestTimeAfter, scrubStep };
export type { ScrubStep };
