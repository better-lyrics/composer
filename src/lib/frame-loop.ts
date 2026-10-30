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

function pump(now: number): void {
  rafId = null;
  framesSinceWake += 1;
  if (isHeldAwake()) tailFrames = TAIL_FRAMES;
  else tailFrames -= 1;
  const rescheduling = tailFrames > 0;
  // Queued before any callback runs, so nothing a subscriber does can stop the loop.
  if (rescheduling) schedule();
  for (const subscriber of subscribers) runRead(subscriber, now);
  for (const subscriber of subscribers) runWrite(subscriber, now);
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

function nextFrame(callback: FrameCallback): number {
  return window.requestAnimationFrame(callback);
}

function cancelNextFrame(handle: number): void {
  window.cancelAnimationFrame(handle);
}

// -- Exports ------------------------------------------------------------------

export { TAIL_FRAMES, animateFrames, cancelNextFrame, holdFrames, nextFrame, subscribeFrame, wake };
export type { FrameCallback, FramePhases };
