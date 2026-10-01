import { sharedAudioContext } from "@/audio/shared-audio-context";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";

const SNIPPET_S = 0.12;
const CROSSFADE_S = 0.008;
const MIN_AUDIBLE_RATE = 0.1;
const MAX_BUFFER_DURATION_S = 60 * 60;
const LOG_PREFIX = "[ScrubPreview]";

type ActiveSnippet = { time: number; rate: number };
type BufferLoader = () => Promise<AudioBuffer>;

let buffer: AudioBuffer | null = null;
let loadBuffer: BufferLoader | null = null;
let bufferToken = 0;
let loadingToken: number | null = null;
let pendingSnippet: ActiveSnippet | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentGain: GainNode | null = null;
let activeSnippet: ActiveSnippet | null = null;

function getContext(): AudioContext {
  const ctx = sharedAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function useBuffer(next: AudioBuffer | null): void {
  stop();
  bufferToken += 1;
  loadBuffer = null;
  loadingToken = null;
  if (next && next.duration > MAX_BUFFER_DURATION_S) {
    console.warn(LOG_PREFIX, `buffer exceeds ${MAX_BUFFER_DURATION_S}s cap; scrub preview disabled for this source`);
    buffer = null;
    return;
  }
  buffer = next;
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

function fadeOutAndStop(source: AudioBufferSourceNode, gain: GainNode): void {
  const ctx = getContext();
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_S);
  try {
    source.stop(now + CROSSFADE_S + 0.002);
  } catch {
    /* source already ended; safe to ignore */
  }
}

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

  const ctx = getContext();
  const maxStartTime = Math.max(0, buffer.duration - SNIPPET_S);
  const clampedTime = Math.max(0, Math.min(time, maxStartTime));

  if (currentSource && currentGain) {
    fadeOutAndStop(currentSource, currentGain);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const audioState = useAudioStore.getState();
  const targetVolume = audioState.isMuted ? 0 : audioState.volume;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(targetVolume, now + CROSSFADE_S);

  source.connect(gain);
  gain.connect(ctx.destination);

  source.start(now, clampedTime, SNIPPET_S);

  currentSource = source;
  currentGain = gain;
  activeSnippet = { time: clampedTime, rate: velocity };

  source.onended = () => {
    if (currentSource === source) {
      currentSource = null;
      currentGain = null;
      activeSnippet = null;
    }
  };
}

function stop(): void {
  pendingSnippet = null;
  if (currentSource && currentGain) {
    fadeOutAndStop(currentSource, currentGain);
  }
  currentSource = null;
  currentGain = null;
  activeSnippet = null;
}

function getActiveSnippet(): ActiveSnippet | null {
  return activeSnippet;
}

const scrubPreview = { useBuffer, useLazyBuffer, play, stop, getActiveSnippet };

export { scrubPreview };
