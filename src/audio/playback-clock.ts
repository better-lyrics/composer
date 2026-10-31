import { clockRoundingMs, currentFrameTime } from "@/lib/frame-loop";

// -- Constants -----------------------------------------------------------------

const OBSERVATION_WINDOW_MS = 1000;
const MAX_OBSERVATIONS = 256;
const MAX_EXTRAPOLATION_MS = 60;
const CONFLICT_TOLERANCE_SECONDS = 0.005;
// No new element time for this long while playing means the audio stalled, so the clock waits at the element.
const STALL_MS = 100;
// An element time that holds still across frames is published in steps (Firefox), not computed at each read (Chrome).
const STEPPED_EVIDENCE_MS = 12;
const DISPLAY_SMOOTHING_MS = 150;
const DISPLAY_RESYNC_SECONDS = 0.1;

// -- State ---------------------------------------------------------------------

// Each new element value bounds the audio line `time = rate * now + offset` from below by `value - rate * readAt`:
// it was published no later than the read that first saw it. A stepped clock is only ever behind, so the highest bound
// is the line; an exact clock scatters around it while it time-stretches, so the mean is.
const observations = {
  offsets: new Float64Array(MAX_OBSERVATIONS),
  at: new Float64Array(MAX_OBSERVATIONS),
  first: 0,
  count: 0,
  generation: 0,
};
const lastRead = {
  element: null as HTMLAudioElement | null,
  time: 0,
  readAt: 0,
  rate: 1,
  running: false,
  stepSeconds: 0,
  changedAt: 0,
  steppedAt: Number.NEGATIVE_INFINITY,
};
const display = { generation: -1, offset: 0, at: 0, time: 0 };
let resyncPending = true;

// -- Observations --------------------------------------------------------------

function clearObservations(): void {
  observations.first = 0;
  observations.count = 0;
  observations.generation += 1;
}

function addObservation(offset: number, at: number): void {
  if (observations.count === MAX_OBSERVATIONS) {
    observations.first = (observations.first + 1) % MAX_OBSERVATIONS;
    observations.count -= 1;
  }
  const slot = (observations.first + observations.count) % MAX_OBSERVATIONS;
  observations.offsets[slot] = offset;
  observations.at[slot] = at;
  observations.count += 1;
}

function isStepped(now: number): boolean {
  return now - lastRead.steppedAt < OBSERVATION_WINDOW_MS;
}

function bestOffset(now: number): number {
  while (observations.count > 0 && observations.at[observations.first] < now - OBSERVATION_WINDOW_MS) {
    observations.first = (observations.first + 1) % MAX_OBSERVATIONS;
    observations.count -= 1;
  }
  if (observations.count === 0) return Number.NEGATIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (let index = 0; index < observations.count; index++) {
    const offset = observations.offsets[(observations.first + index) % MAX_OBSERVATIONS];
    highest = Math.max(highest, offset);
    sum += offset;
  }
  return isStepped(now) ? highest : sum / observations.count;
}

// A stepped clock may never pass its last bound from above; an exact one only clears on a jump past its scatter.
function contradicts(offset: number, ceiling: number, now: number): boolean {
  const best = bestOffset(now);
  if (best === Number.NEGATIVE_INFINITY) return false;
  return isStepped(now)
    ? best > ceiling + CONFLICT_TOLERANCE_SECONDS
    : Math.abs(offset - best) > DISPLAY_RESYNC_SECONDS;
}

function isClockRunning(element: HTMLAudioElement): boolean {
  return !element.paused && !element.seeking && element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
}

// A rounded clock (Firefox resistFingerprinting) reads up to one rounding step early, so the bound assumes the latest.
function observe(element: HTMLAudioElement, time: number, running: boolean, readAt: number): void {
  const rate = element.playbackRate;
  const continuous =
    !resyncPending && element === lastRead.element && rate === lastRead.rate && running && lastRead.running;
  if (!continuous) clearObservations();
  else if (time !== lastRead.time) {
    const latestReadAt = readAt + clockRoundingMs();
    const offset = time - (rate * latestReadAt) / 1000;
    const ceiling = time - (rate * lastRead.readAt) / 1000;
    if (contradicts(offset, ceiling, readAt)) clearObservations();
    addObservation(offset, readAt);
    lastRead.stepSeconds = Math.abs(time - lastRead.time);
    lastRead.changedAt = readAt;
  } else {
    const heldMs = readAt - lastRead.changedAt;
    if (heldMs > STEPPED_EVIDENCE_MS) lastRead.steppedAt = readAt;
    if (heldMs > STALL_MS) clearObservations();
  }
  resyncPending = false;
  lastRead.element = element;
  lastRead.time = time;
  lastRead.readAt = readAt;
  lastRead.rate = rate;
  lastRead.running = running;
}

// -- Display -------------------------------------------------------------------

// Frames ease toward a better estimate instead of jumping to it, and never step back while it stands.
function displayOffset(offset: number, now: number): number {
  if (display.generation !== observations.generation || Math.abs(offset - display.offset) > DISPLAY_RESYNC_SECONDS) {
    display.offset = offset;
  } else {
    const elapsed = Math.max(0, now - display.at);
    display.offset += (offset - display.offset) * (1 - Math.exp(-elapsed / DISPLAY_SMOOTHING_MS));
  }
  return display.offset;
}

// -- Clock ---------------------------------------------------------------------

function resyncPlaybackClock(): void {
  resyncPending = true;
}

function readPlaybackClock(element: HTMLAudioElement, at?: number): number {
  const readAt = performance.now();
  const frameNow = currentFrameTime();
  const now = frameNow ?? at ?? readAt + clockRoundingMs() / 2;
  const running = isClockRunning(element);
  const elementTime = element.currentTime;
  observe(element, elementTime, running, readAt);
  const offset = running ? bestOffset(readAt) : Number.NEGATIVE_INFINITY;
  if (offset === Number.NEGATIVE_INFINITY) {
    display.generation = -1;
    return elementTime;
  }
  const rate = element.playbackRate;
  const lineOffset = frameNow === null ? offset : displayOffset(offset, now);
  const maxExtrapolation = (rate * MAX_EXTRAPOLATION_MS) / 1000;
  const stepCeiling = isStepped(readAt) ? Math.min(lastRead.stepSeconds * 1.5, maxExtrapolation) : maxExtrapolation;
  let time = Math.min((rate * now) / 1000 + lineOffset, elementTime + stepCeiling);
  if (Number.isFinite(element.duration)) time = Math.min(time, element.duration);
  if (frameNow === null) return time;
  if (display.generation === observations.generation) time = Math.max(time, display.time);
  display.generation = observations.generation;
  display.at = now;
  display.time = time;
  return time;
}

// -- Exports -------------------------------------------------------------------

export { readPlaybackClock, resyncPlaybackClock };
