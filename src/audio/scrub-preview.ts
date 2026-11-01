import { SCRUB_HOLD_S, scrubTo, silenceStretch, useStretchBuffer } from "@/audio/scrub-stretch";
import { sharedAudioContext } from "@/audio/shared-audio-context";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

type ActiveSnippet = { time: number; rate: number };
type BufferLoader = () => Promise<AudioBuffer>;

// -- Constants ----------------------------------------------------------------

const MIN_AUDIBLE_RATE = 0.1;
const MAX_BUFFER_DURATION_S = 60 * 60;
const LOG_PREFIX = "[ScrubPreview]";

// -- State --------------------------------------------------------------------

let buffer: AudioBuffer | null = null;
let loadBuffer: BufferLoader | null = null;
let bufferToken = 0;
let loadingToken: number | null = null;
let pendingSnippet: ActiveSnippet | null = null;
let activeSnippet: ActiveSnippet | null = null;
let lastEventMs = Number.NEGATIVE_INFINITY;

// -- Audio --------------------------------------------------------------------

function resumeContext(): void {
  const ctx = sharedAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

function targetVolume(): number {
  const { isMuted, volume } = useAudioStore.getState();
  return isMuted ? 0 : volume;
}

// -- Buffer -------------------------------------------------------------------

function useBuffer(next: AudioBuffer | null): void {
  stop();
  bufferToken += 1;
  loadBuffer = null;
  loadingToken = null;
  if (next && next.duration > MAX_BUFFER_DURATION_S) {
    console.warn(LOG_PREFIX, `buffer exceeds ${MAX_BUFFER_DURATION_S}s cap; scrub preview disabled for this source`);
    buffer = null;
  } else {
    buffer = next;
  }
  useStretchBuffer(buffer);
}

function useLazyBuffer(load: BufferLoader): void {
  useBuffer(null);
  loadBuffer = load;
}

function requestBuffer(time: number, velocity: number): void {
  pendingSnippet = { time, rate: velocity };
  if (!loadBuffer || loadingToken === bufferToken) return;
  const token = bufferToken;
  loadingToken = token;
  loadBuffer().then(
    (next) => {
      if (token !== bufferToken) return;
      const snippet = pendingSnippet;
      useBuffer(next);
      if (snippet) play(snippet.time, snippet.rate);
    },
    (err: unknown) => {
      if (token !== bufferToken) return;
      console.warn(LOG_PREFIX, "could not decode audio for scrub preview", err);
      useBuffer(null);
    },
  );
}

// -- Playback -----------------------------------------------------------------

function isEnabled(): boolean {
  return useSettingsStore.getState().audioScrubPreview;
}

function play(time: number, velocity: number): void {
  if (!isEnabled()) return;
  if (velocity < MIN_AUDIBLE_RATE) return;
  if (!buffer) {
    requestBuffer(time, velocity);
    return;
  }

  const clampedTime = Math.max(0, Math.min(time, buffer.duration));
  activeSnippet = { time: clampedTime, rate: velocity };
  lastEventMs = performance.now();
  resumeContext();
  scrubTo({ buffer, time: clampedTime, rate: velocity, volume: targetVolume() });
}

function stop(): void {
  pendingSnippet = null;
  activeSnippet = null;
  silenceStretch();
}

function getActiveSnippet(): ActiveSnippet | null {
  return performance.now() - lastEventMs > SCRUB_HOLD_S * 1000 ? null : activeSnippet;
}

// -- Exports ------------------------------------------------------------------

const scrubPreview = { useBuffer, useLazyBuffer, play, stop, getActiveSnippet };

export { scrubPreview };
