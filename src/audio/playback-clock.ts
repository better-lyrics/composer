import { currentFrameTime, isFrameScheduled } from "@/lib/frame-loop";

// -- Constants -----------------------------------------------------------------

const MAX_EXTRAPOLATION_MS = 60;
const CLOCK_SMOOTHING_MS = 150;
const CLOCK_RESYNC_SECONDS = 0.1;
const CLOCK_MAX_LEAD_SECONDS = 0.025;

// -- State ---------------------------------------------------------------------

const lastSeenClock = {
  element: null as HTMLAudioElement | null,
  time: 0,
  seenAt: 0,
  running: false,
  advancing: false,
  stepMs: MAX_EXTRAPOLATION_MS,
};
const smoothedClock = {
  element: null as HTMLAudioElement | null,
  time: 0,
  at: 0,
  rate: 1,
  running: false,
  seekPending: false,
};

// -- Functions -----------------------------------------------------------------

function isClockRunning(element: HTMLAudioElement): boolean {
  return !element.paused && !element.seeking && element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
}

function isNewElementTime(element: HTMLAudioElement, time: number, running: boolean): boolean {
  return (
    element !== lastSeenClock.element || time !== lastSeenClock.time || !running || running !== lastSeenClock.running
  );
}

// Output starts a while after play or a seek; until the element time moves, nothing runs on.
function isAdvancing(element: HTMLAudioElement, time: number, running: boolean): boolean {
  if (!isNewElementTime(element, time, running)) return lastSeenClock.advancing;
  if (element !== lastSeenClock.element) return running;
  return running && running === lastSeenClock.running && !smoothedClock.seekPending;
}

// Firefox advances `currentTime` once per audio buffer (~43 ms), so it runs on for at most one such step.
function measuredElementTime(element: HTMLAudioElement, time: number, running: boolean, now: number): number {
  if (isNewElementTime(element, time, running)) return time;
  const elapsedMs = Math.min(lastSeenClock.stepMs, Math.max(0, now - lastSeenClock.seenAt));
  return time + (elapsedMs / 1000) * element.playbackRate;
}

function elementStepMs(element: HTMLAudioElement, time: number, advancing: boolean): number {
  if (element !== lastSeenClock.element) return MAX_EXTRAPOLATION_MS;
  if (!advancing || time <= lastSeenClock.time) return lastSeenClock.stepMs;
  return Math.min(MAX_EXTRAPOLATION_MS, ((time - lastSeenClock.time) * 1000) / element.playbackRate);
}

// A seek can finish between two frames, so no frame ever sees `seeking`.
function resyncPlaybackClock(): void {
  smoothedClock.seekPending = true;
}

// Eases toward the jittery element time on frame time; only frames move it, so reads in between never shift a frame.
function readPlaybackClock(audioElement: HTMLAudioElement, at?: number): number {
  const frameNow = currentFrameTime();
  const now = frameNow ?? at ?? performance.now();
  const running = isClockRunning(audioElement);
  const elementTime = audioElement.currentTime;
  const advancing = isAdvancing(audioElement, elementTime, running);
  const measured = advancing ? measuredElementTime(audioElement, elementTime, running, now) : elementTime;
  const rate = audioElement.playbackRate;
  const elapsedMs = Math.max(0, now - smoothedClock.at);
  const predicted = smoothedClock.time + (elapsedMs / 1000) * smoothedClock.rate;
  const resync =
    !advancing ||
    !lastSeenClock.advancing ||
    !smoothedClock.running ||
    smoothedClock.seekPending ||
    smoothedClock.element !== audioElement ||
    smoothedClock.rate !== rate ||
    Math.abs(measured - predicted) > CLOCK_RESYNC_SECONDS;
  const eased = predicted + (measured - predicted) * (1 - Math.exp(-elapsedMs / CLOCK_SMOOTHING_MS));
  const time = resync ? measured : Math.max(smoothedClock.time, Math.min(eased, measured + CLOCK_MAX_LEAD_SECONDS));
  if (frameNow === null && isFrameScheduled()) return time;
  if (isNewElementTime(audioElement, elementTime, running)) {
    lastSeenClock.stepMs = elementStepMs(audioElement, elementTime, advancing);
    lastSeenClock.advancing = advancing;
    lastSeenClock.element = audioElement;
    lastSeenClock.time = elementTime;
    lastSeenClock.seenAt = now;
    lastSeenClock.running = running;
  }
  smoothedClock.element = audioElement;
  smoothedClock.time = time;
  smoothedClock.at = now;
  smoothedClock.rate = rate;
  smoothedClock.running = running;
  smoothedClock.seekPending = false;
  return time;
}

// -- Exports -------------------------------------------------------------------

export { readPlaybackClock, resyncPlaybackClock };
