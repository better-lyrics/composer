import { alignedGrainOffset } from "@/audio/grain-alignment";
import { type ScrubSound, fadeOutScrubSound, startScrubSound } from "@/audio/scrub-sound";
import { sharedAudioContext } from "@/audio/shared-audio-context";
import { holdFrames, subscribeFrame } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

type ActiveSnippet = { time: number; rate: number };
type BufferLoader = () => Promise<AudioBuffer>;

// -- Constants ----------------------------------------------------------------

const GRAIN_S = 0.024;
const CROSSFADE_S = 0.008;
const GRAIN_HOP_S = GRAIN_S - CROSSFADE_S;
const ALIGN_SEARCH_S = 0.008;
const LOOKAHEAD_S = 0.05;
const STOP_FADE_S = 0.01;
const STOP_AFTER_MS = 100;
const MIN_AUDIBLE_RATE = 0.1;
const MAX_BUFFER_DURATION_S = 60 * 60;
const FRAME_LABEL = "scrub-preview";
const LOG_PREFIX = "[ScrubPreview]";

// -- State --------------------------------------------------------------------

let buffer: AudioBuffer | null = null;
let loadBuffer: BufferLoader | null = null;
let bufferToken = 0;
let loadingToken: number | null = null;
let pendingSnippet: ActiveSnippet | null = null;
let activeSnippet: ActiveSnippet | null = null;
let grains: ScrubSound[] = [];
let targetTime = 0;
let lastEventMs = Number.NEGATIVE_INFINITY;
let nextGrainAt = 0;
let lastGrainOffset = Number.NEGATIVE_INFINITY;
let releaseScheduler: (() => void) | null = null;

// -- Audio --------------------------------------------------------------------

function getContext(): AudioContext {
  const ctx = sharedAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// currentTime can trail the render thread by one callback, and a ramp that starts in the past jumps.
function scheduleTime(ctx: AudioContext): number {
  return ctx.currentTime + (Number.isFinite(ctx.baseLatency) ? ctx.baseLatency : 0);
}

function targetVolume(): number {
  const { isMuted, volume } = useAudioStore.getState();
  return isMuted ? 0 : volume;
}

const channelCache = new WeakMap<AudioBuffer, Float32Array[]>();

function channelsOf(source: AudioBuffer): Float32Array[] {
  let channels = channelCache.get(source);
  if (!channels) {
    channels = Array.from({ length: source.numberOfChannels }, (_, index) => source.getChannelData(index));
    channelCache.set(source, channels);
  }
  return channels;
}

// A steady drag lands on the previous grain's continuation, which plays the song seamlessly.
function nextGrainOffset(source: AudioBuffer): number {
  if (!Number.isFinite(lastGrainOffset)) return targetTime;
  return alignedGrainOffset(
    channelsOf(source),
    source.sampleRate,
    lastGrainOffset + GRAIN_HOP_S,
    targetTime,
    ALIGN_SEARCH_S,
    CROSSFADE_S,
  );
}

function startGrain(ctx: AudioContext, source: AudioBuffer, at: number): void {
  const offset = Math.max(0, Math.min(nextGrainOffset(source), source.duration - GRAIN_S));
  const grain = startScrubSound(ctx, {
    buffer: source,
    offset,
    at,
    volume: targetVolume(),
    fadeS: CROSSFADE_S,
    lengthS: GRAIN_S,
  });
  grain.source.addEventListener("ended", () => {
    grains = grains.filter((live) => live !== grain);
  });
  grains.push(grain);
  lastGrainOffset = offset;
  nextGrainAt = at + GRAIN_HOP_S;
}

// -- Scheduler ----------------------------------------------------------------

function endSession(): void {
  releaseScheduler?.();
  releaseScheduler = null;
  activeSnippet = null;
  lastGrainOffset = Number.NEGATIVE_INFINITY;
  lastEventMs = Number.NEGATIVE_INFINITY;
}

// A frame callback must never write to a store: this one only touches audio nodes and module state.
// Grains are scheduled only a few frames ahead, so a hidden tab, which pauses frames, falls silent on its own.
function scheduleGrains(nowMs: number): void {
  if (!buffer || nowMs - lastEventMs > STOP_AFTER_MS) {
    endSession();
    return;
  }
  const ctx = sharedAudioContext();
  const now = scheduleTime(ctx);
  if (nextGrainAt < now) nextGrainAt = now;
  while (nextGrainAt < now + LOOKAHEAD_S) startGrain(ctx, buffer, nextGrainAt);
}

function ensureScheduler(): void {
  if (releaseScheduler) return;
  const releaseHold = holdFrames(FRAME_LABEL);
  const unsubscribe = subscribeFrame(scheduleGrains, FRAME_LABEL);
  releaseScheduler = () => {
    unsubscribe();
    releaseHold();
  };
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

  targetTime = Math.max(0, Math.min(time, Math.max(0, buffer.duration - GRAIN_S)));
  lastEventMs = performance.now();
  activeSnippet = { time: targetTime, rate: velocity };
  if (!releaseScheduler) {
    const ctx = getContext();
    const at = scheduleTime(ctx);
    fadeOutGrains(at, CROSSFADE_S);
    startGrain(ctx, buffer, at);
    ensureScheduler();
  }
}

function fadeOutGrains(at: number, fadeS: number): void {
  for (const grain of grains) fadeOutScrubSound(grain, at, fadeS);
  grains = [];
}

function stop(): void {
  pendingSnippet = null;
  if (grains.length > 0) fadeOutGrains(scheduleTime(sharedAudioContext()), STOP_FADE_S);
  endSession();
}

function getActiveSnippet(): ActiveSnippet | null {
  return activeSnippet;
}

// -- Exports ------------------------------------------------------------------

const scrubPreview = { useBuffer, useLazyBuffer, play, stop, getActiveSnippet };

export { scrubPreview };
