// -- Types --------------------------------------------------------------------

type FrameCallback = (now: number) => void;

// -- Constants ----------------------------------------------------------------

const TAIL_FRAMES = 3;

// -- State --------------------------------------------------------------------

const subscribers = new Set<FrameCallback>();
const liveSources = new Set<string>();
let tailFrames = 0;
let rafId: number | null = null;

// -- Scheduler ----------------------------------------------------------------

function schedule(): void {
  if (rafId !== null || subscribers.size === 0) return;
  rafId = window.requestAnimationFrame(pump);
}

function pump(now: number): void {
  rafId = null;
  if (liveSources.size > 0) tailFrames = TAIL_FRAMES;
  else tailFrames -= 1;
  for (const callback of subscribers) callback(now);
  if (tailFrames > 0) schedule();
}

function wake(): void {
  tailFrames = TAIL_FRAMES;
  schedule();
}

function setFrameSource(name: string, live: boolean): void {
  if (live === liveSources.has(name)) return;
  if (live) liveSources.add(name);
  else liveSources.delete(name);
  wake();
}

function subscribeFrame(callback: FrameCallback): () => void {
  subscribers.add(callback);
  wake();
  return () => {
    subscribers.delete(callback);
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

export { TAIL_FRAMES, cancelNextFrame, nextFrame, setFrameSource, subscribeFrame, wake };
export type { FrameCallback };
