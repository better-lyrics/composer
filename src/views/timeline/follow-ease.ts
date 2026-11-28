// -- Constants ----------------------------------------------------------------

const FRAME_60HZ_MS = 1000 / 60;
// Share of the remaining distance the follow scroll closes per 60 Hz frame's worth of time.
const EASE_PER_60HZ_FRAME = 0.15;
// A tab that was hidden or a long frame does not jump the scroll in one step.
const MAX_STEP_MS = 100;
// The ease never truly ends; past this share of the move it reads as settled.
const SETTLED_SHARE = 0.95;

// Wall-clock seconds the ease takes to settle, so a line followed this early lands as it starts.
const FOLLOW_LEAD_SECONDS = ((Math.log(1 - SETTLED_SHARE) / Math.log(1 - EASE_PER_60HZ_FRAME)) * FRAME_60HZ_MS) / 1000;

// -- Functions ----------------------------------------------------------------

// Time-based, so the scroll takes as long on a 240 Hz display as on a 60 Hz one.
function followEaseShare(elapsedMs: number): number {
  const frames = Math.min(Math.max(elapsedMs, 0), MAX_STEP_MS) / FRAME_60HZ_MS;
  return 1 - (1 - EASE_PER_60HZ_FRAME) ** frames;
}

// -- Exports ------------------------------------------------------------------

export { FOLLOW_LEAD_SECONDS, FRAME_60HZ_MS, followEaseShare };
