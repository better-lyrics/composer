// -- Types --------------------------------------------------------------------

type FrameCallback = (now: number) => void;

// Every read of every subscriber runs before any write, so phased reads never force a layout.
interface FramePhases {
  read: FrameCallback;
  write: FrameCallback;
}

interface FrameSubscriber {
  read: FrameCallback | null;
  write: FrameCallback;
  label: string;
  readFailing: boolean;
  writeFailing: boolean;
  readThisFrame: boolean;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[FrameLoop]";

const phaseName = { readFailing: "read", writeFailing: "write" } as const;

// 3 frames covers a React commit landing a DOM write on the frame after the store notify.
const TAIL_FRAMES = 3;

const RUNAWAY_WAKE_FRAMES = 600;
const STALE_HOLD_FRAMES = 600;

// Past this gap the loop slept, so pacing starts over from the stamp.
const MAX_PACED_GAP_MS = 100;
const PACING_CORRECTION = 0.02;
const ROUNDING_TOLERANCE_MS = 0.01;
const MIN_ROUNDING_MS = 1;

// -- State --------------------------------------------------------------------

const subscribers = new Set<FrameSubscriber>();
const holds = new Map<string, number>();
const animations = new Map<string, number>();
let tailFrames = 0;
let rafId: number | null = null;
let unheldFrameRun = 0;
let framesSinceWake = 0;
let hasReportedRunawayWakes = false;
let hasReportedStaleHold = false;
let dispatchingFrameTime: number | null = null;
// Firefox with privacy.resistFingerprinting rounds frame stamps to 16.67 ms, so two frames can share one.
const pacing = {
  stamp: Number.NEGATIVE_INFINITY,
  time: 0,
  since: 0,
  frames: 0,
  rounding: 0,
  repeated: false,
};

// -- Diagnostics --------------------------------------------------------------

function subscriberLabels(): string[] {
  return [...subscribers].map((subscriber) => subscriber.label);
}

function reportRunawayFrames(rescheduling: boolean): void {
  if (!rescheduling) {
    unheldFrameRun = 0;
    return;
  }
  if (holds.size > 0) {
    unheldFrameRun = 0;
    if (framesSinceWake < STALE_HOLD_FRAMES || hasReportedStaleHold) return;
    hasReportedStaleHold = true;
    console.error(
      `${LOG_PREFIX} loop held for ${framesSinceWake} frames with nothing waking it; unreleased hold: ${[...holds.keys()].join(", ")}`,
    );
    return;
  }
  if (animations.size > 0) {
    unheldFrameRun = 0;
    return;
  }
  unheldFrameRun += 1;
  if (unheldFrameRun < RUNAWAY_WAKE_FRAMES || hasReportedRunawayWakes) return;
  hasReportedRunawayWakes = true;
  console.error(
    `${LOG_PREFIX} loop never idled across ${unheldFrameRun} frames with no hold held; a frame callback is probably writing to a store every frame. Subscribers: ${subscriberLabels().join(", ")}`,
  );
}

// -- Scheduler ----------------------------------------------------------------

function isHeldAwake(): boolean {
  return holds.size > 0 || animations.size > 0;
}

function schedule(): void {
  if (rafId !== null || subscribers.size === 0) return;
  rafId = window.requestAnimationFrame(pump);
}

// Returns whether the phase ran clean; a phase that keeps failing logs once until it recovers.
function runPhase(
  subscriber: FrameSubscriber,
  phase: FrameCallback,
  failingKey: "readFailing" | "writeFailing",
  now: number,
): boolean {
  try {
    phase(now);
    subscriber[failingKey] = false;
    return true;
  } catch (error) {
    if (subscriber[failingKey]) return false;
    subscriber[failingKey] = true;
    console.error(
      `${LOG_PREFIX} frame callback "${subscriber.label}" failed in its ${phaseName[failingKey]} phase`,
      error,
    );
    return false;
  }
}

function runRead(subscriber: FrameSubscriber, now: number): void {
  if (subscriber.read) subscriber.readThisFrame = runPhase(subscriber, subscriber.read, "readFailing", now);
}

function runWrite(subscriber: FrameSubscriber, now: number): void {
  if (subscriber.read && !subscriber.readThisFrame) return;
  subscriber.readThisFrame = false;
  runPhase(subscriber, subscriber.write, "writeFailing", now);
}

// The largest step every gap so far is a whole multiple of; a jittery clock drives it toward zero.
function commonStep(larger: number, smaller: number): number {
  let a = larger;
  let b = smaller;
  while (b > ROUNDING_TOLERANCE_MS) {
    const remainder = a % b;
    [a, b] = [b, b - remainder < ROUNDING_TOLERANCE_MS ? 0 : remainder];
  }
  return a;
}

function isClockRounded(): boolean {
  return pacing.repeated && pacing.rounding >= MIN_ROUNDING_MS;
}

// A rounded clock repeats stamps and moves only in whole steps; its frames advance by the mean frame period instead.
function pacedFrameTime(stamp: number): number {
  const elapsed = stamp - pacing.stamp;
  pacing.stamp = stamp;
  if (elapsed < 0 || elapsed > MAX_PACED_GAP_MS) {
    pacing.time = stamp;
    pacing.since = stamp;
    pacing.frames = 0;
    return stamp;
  }
  pacing.frames += 1;
  if (elapsed === 0) pacing.repeated = true;
  else
    pacing.rounding =
      pacing.rounding === 0
        ? elapsed
        : commonStep(Math.max(pacing.rounding, elapsed), Math.min(pacing.rounding, elapsed));
  if (!isClockRounded() || stamp === pacing.since) {
    pacing.time = stamp;
    return stamp;
  }
  const predicted = pacing.time + (stamp - pacing.since) / pacing.frames;
  const corrected = predicted + (stamp + pacing.rounding / 2 - predicted) * PACING_CORRECTION;
  pacing.time = Math.min(Math.max(corrected, stamp), stamp + pacing.rounding);
  return pacing.time;
}

function pump(stamp: number): void {
  const now = pacedFrameTime(stamp);
  rafId = null;
  framesSinceWake += 1;
  if (isHeldAwake()) tailFrames = TAIL_FRAMES;
  else tailFrames -= 1;
  const rescheduling = tailFrames > 0;
  // Queued before any callback runs, so nothing a subscriber does can stop the loop.
  if (rescheduling) schedule();
  dispatchingFrameTime = now;
  for (const subscriber of subscribers) runRead(subscriber, now);
  for (const subscriber of subscribers) runWrite(subscriber, now);
  dispatchingFrameTime = null;
  if (import.meta.env.DEV) reportRunawayFrames(rescheduling);
}

function wake(): void {
  tailFrames = TAIL_FRAMES;
  framesSinceWake = 0;
  schedule();
}

function retain(counts: Map<string, number>, label: string): () => void {
  counts.set(label, (counts.get(label) ?? 0) + 1);
  wake();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (counts.get(label) ?? 1) - 1;
    if (remaining > 0) counts.set(label, remaining);
    else counts.delete(label);
    wake();
  };
}

function holdFrames(label: string): () => void {
  return retain(holds, label);
}

function animateFrames(label: string): () => void {
  return retain(animations, label);
}

function subscribeFrame(callback: FrameCallback | FramePhases, label: string): () => void {
  const phases = typeof callback === "function" ? { read: null, write: callback } : callback;
  const subscriber: FrameSubscriber = {
    ...phases,
    label,
    readFailing: false,
    writeFailing: false,
    readThisFrame: false,
  };
  subscribers.add(subscriber);
  wake();
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0 && rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

// Positions drawn in a frame follow its timestamp, not the moment their callback happens to run.
function currentFrameTime(): number | null {
  return dispatchingFrameTime;
}

// How far the page clock rounds down; 0 until a repeated frame stamp proves it rounds.
function clockRoundingMs(): number {
  return isClockRounded() ? pacing.rounding : 0;
}

function frameTime(): number {
  return dispatchingFrameTime ?? performance.now();
}

function nextFrame(callback: FrameCallback): number {
  return window.requestAnimationFrame(callback);
}

function cancelNextFrame(handle: number): void {
  window.cancelAnimationFrame(handle);
}

// -- Exports ------------------------------------------------------------------

export {
  TAIL_FRAMES,
  animateFrames,
  cancelNextFrame,
  clockRoundingMs,
  currentFrameTime,
  frameTime,
  holdFrames,
  nextFrame,
  subscribeFrame,
  wake,
};
export type { FrameCallback, FramePhases };
