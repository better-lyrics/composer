// -- Types --------------------------------------------------------------------

type FrameCallback = (now: number) => void;

interface FrameSubscriber {
  callback: FrameCallback;
  label: string;
  failing: boolean;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[FrameLoop]";

// 3 frames covers a React commit landing a DOM write on the frame after the store notify.
const TAIL_FRAMES = 3;

const RUNAWAY_WAKE_FRAMES = 600;
const STALE_HOLD_FRAMES = 600;

// -- State --------------------------------------------------------------------

const subscribers = new Set<FrameSubscriber>();
const holds = new Map<string, number>();
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
  unheldFrameRun += 1;
  if (unheldFrameRun < RUNAWAY_WAKE_FRAMES || hasReportedRunawayWakes) return;
  hasReportedRunawayWakes = true;
  console.error(
    `${LOG_PREFIX} loop never idled across ${unheldFrameRun} frames with no hold held; a frame callback is probably writing to a store every frame. Subscribers: ${subscriberLabels().join(", ")}`,
  );
}

// -- Scheduler ----------------------------------------------------------------

function schedule(): void {
  if (rafId !== null || subscribers.size === 0) return;
  rafId = window.requestAnimationFrame(pump);
}

function runSubscriber(subscriber: FrameSubscriber, now: number): void {
  try {
    subscriber.callback(now);
    subscriber.failing = false;
  } catch (error) {
    if (subscriber.failing) return;
    subscriber.failing = true;
    console.error(`${LOG_PREFIX} frame callback "${subscriber.label}" failed`, error);
  }
}

function pump(now: number): void {
  rafId = null;
  framesSinceWake += 1;
  if (holds.size > 0) tailFrames = TAIL_FRAMES;
  else tailFrames -= 1;
  const rescheduling = tailFrames > 0;
  // Queued before any callback runs, so nothing a subscriber does can stop the loop.
  if (rescheduling) schedule();
  for (const subscriber of subscribers) runSubscriber(subscriber, now);
  if (import.meta.env.DEV) reportRunawayFrames(rescheduling);
}

function wake(): void {
  tailFrames = TAIL_FRAMES;
  framesSinceWake = 0;
  schedule();
}

function holdFrames(label: string): () => void {
  holds.set(label, (holds.get(label) ?? 0) + 1);
  wake();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (holds.get(label) ?? 1) - 1;
    if (remaining > 0) holds.set(label, remaining);
    else holds.delete(label);
    wake();
  };
}

function subscribeFrame(callback: FrameCallback, label: string): () => void {
  const subscriber: FrameSubscriber = { callback, label, failing: false };
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

export { TAIL_FRAMES, cancelNextFrame, holdFrames, nextFrame, subscribeFrame, wake };
export type { FrameCallback };
