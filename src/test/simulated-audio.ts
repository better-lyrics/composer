// -- Interfaces ----------------------------------------------------------------

interface SimulatedAudioOptions {
  start: number;
  rate?: number;
  // Firefox publishes the position on a 40 ms timer; Chrome computes it at every read.
  tickMs?: number;
  tickPhaseMs?: number;
  // A published step reaches the page this much later (Firefox hands it to the main thread).
  visibleAfterMs?: number;
  // Chrome's exact time scatters around the heard position while it time-stretches (rates other than 1).
  jitterMs?: readonly number[];
  duration?: number;
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
}: SimulatedAudioOptions): SimulatedAudio {
  const element = document.createElement("audio");
  let anchorTime = start;
  let anchorAt = performance.now();
  let running = false;
  let paused = true;
  let seeking = false;
  let reads = 0;
  const heard = () => (running ? anchorTime + (rate * (performance.now() - anchorAt)) / 1000 : anchorTime);
  const reported = () => {
    if (!running) return heard();
    if (tickMs === 0) return heard() + jitterMs[reads++ % jitterMs.length] / 1000;
    const now = performance.now() - visibleAfterMs;
    const lastTick = Math.floor((now - tickPhaseMs) / tickMs) * tickMs + tickPhaseMs;
    return lastTick <= anchorAt ? anchorTime : anchorTime + (rate * (lastTick - anchorAt)) / 1000;
  };
  const freeze = () => {
    anchorTime = heard();
    anchorAt = performance.now();
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
