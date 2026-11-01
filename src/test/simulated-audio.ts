// -- Interfaces ----------------------------------------------------------------

interface SimulatedAudioOptions {
  start: number;
  rate?: number;
  // Firefox publishes the position every 40 ms of media time (160 ms apart at 0.25x); Chrome computes it at every read.
  tickMs?: number;
  tickPhaseMs?: number;
  // A published step reaches the page this much later (Firefox hands it to the main thread).
  visibleAfterMs?: number;
  // Chrome's exact time scatters around the heard position while it time-stretches (rates other than 1); one value per task.
  jitterMs?: readonly number[];
  duration?: number;
  // Chromium starts its output slowly after play: media crawls at this fraction of the rate and the time is published in held steps.
  startup?: { crawlMs: number; crawlRate: number; publishEveryMs: number };
}

interface SimulatedAudio {
  element: HTMLAudioElement;
  // The media time being heard right now.
  heard: () => number;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  // Output stops advancing (buffer underrun) while `paused` stays false.
  stall: () => void;
  resume: () => void;
}

// -- Functions -----------------------------------------------------------------

function simulatedAudio({
  start,
  rate = 1,
  tickMs = 0,
  tickPhaseMs = 0,
  visibleAfterMs = 0,
  jitterMs = [0],
  duration,
  startup,
}: SimulatedAudioOptions): SimulatedAudio {
  const element = document.createElement("audio");
  let anchorTime = start;
  let anchorAt = performance.now();
  let running = false;
  let paused = true;
  let seeking = false;
  let crawling = false;
  const mediaElapsedMs = (elapsedMs: number) => {
    if (!crawling || !startup) return elapsedMs;
    const crawlMs = Math.min(elapsedMs, startup.crawlMs);
    return crawlMs * startup.crawlRate + (elapsedMs - crawlMs);
  };
  const heardAt = (at: number) => (running ? anchorTime + (rate * mediaElapsedMs(at - anchorAt)) / 1000 : anchorTime);
  const heard = () => heardAt(performance.now());
  const reported = () => {
    if (!running) return heard();
    const elapsedMs = performance.now() - anchorAt;
    if (crawling && startup && elapsedMs < startup.crawlMs)
      return heardAt(anchorAt + Math.floor(elapsedMs / startup.publishEveryMs) * startup.publishEveryMs);
    if (tickMs === 0)
      return heard() + jitterMs[(Math.imul(Math.floor(performance.now()), 2654435761) >>> 0) % jitterMs.length] / 1000;
    const now = performance.now() - visibleAfterMs;
    const tickWallMs = tickMs / rate;
    const lastTick = Math.floor((now - tickPhaseMs) / tickWallMs) * tickWallMs + tickPhaseMs;
    return lastTick <= anchorAt ? anchorTime : anchorTime + (rate * (lastTick - anchorAt)) / 1000;
  };
  const freeze = () => {
    anchorTime = heard();
    anchorAt = performance.now();
    crawling = false;
  };
  Object.defineProperties(element, {
    currentTime: { get: reported, configurable: true },
    paused: { get: () => paused, configurable: true },
    seeking: { get: () => seeking, configurable: true },
    readyState: { get: () => HTMLMediaElement.HAVE_ENOUGH_DATA, configurable: true },
    playbackRate: { get: () => rate, configurable: true },
    duration: { get: () => duration ?? Number.NaN, configurable: true },
  });
  return {
    element,
    heard,
    play: () => {
      freeze();
      paused = false;
      running = true;
      crawling = true;
    },
    pause: () => {
      freeze();
      paused = true;
      running = false;
    },
    seek: (time) => {
      anchorTime = time;
      anchorAt = performance.now();
      seeking = false;
    },
    stall: () => {
      freeze();
      running = false;
    },
    resume: () => {
      freeze();
      running = true;
    },
  };
}

// -- Exports -------------------------------------------------------------------

export { simulatedAudio };
export type { SimulatedAudio };
