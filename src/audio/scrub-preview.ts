import { type ScrubSound, fadeOutScrubSound, retargetScrubSoundVolume, startScrubSound } from "@/audio/scrub-sound";
import { furthestTimeAfter, scrubStep } from "@/audio/scrub-step";
import { sharedAudioContext } from "@/audio/shared-audio-context";
import { holdFrames, subscribeFrame } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

type ActiveSnippet = { time: number; rate: number };
type BufferLoader = () => Promise<AudioBuffer>;

interface Voice {
  sound: ScrubSound;
  position: number;
  rate: number;
  updatedAt: number;
}

// -- Constants ----------------------------------------------------------------

const SNIPPET_S = 0.12;
const CROSSFADE_S = 0.008;
const MIN_AUDIBLE_RATE = 0.1;
const MAX_BUFFER_DURATION_S = 60 * 60;
const RATE_SMOOTHING_S = 0.015;
const MIN_SPEED_INTERVAL_MS = 4;
const MAX_SPEED_INTERVAL_MS = 300;
const MIN_STOP_AFTER_MS = 60;
const FRAME_LABEL = "scrub-preview";
const LOG_PREFIX = "[ScrubPreview]";

// -- State --------------------------------------------------------------------

let buffer: AudioBuffer | null = null;
let loadBuffer: BufferLoader | null = null;
let bufferToken = 0;
let loadingToken: number | null = null;
let pendingSnippet: ActiveSnippet | null = null;
let activeSnippet: ActiveSnippet | null = null;
let voice: Voice | null = null;
let clip: ScrubSound | null = null;
let previousTime = Number.NEGATIVE_INFINITY;
let furthestTime = Number.NEGATIVE_INFINITY;
let lastPlayAtMs = Number.NEGATIVE_INFINITY;
let stopAfterMs = MIN_STOP_AFTER_MS;
let releaseWatchdog: (() => void) | null = null;

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

function voicePosition(running: Voice, now: number): number {
  return running.position + running.rate * (now - running.updatedAt);
}

function fadeOutAll(now: number): void {
  if (voice) fadeOutScrubSound(voice.sound, now, CROSSFADE_S);
  if (clip) fadeOutScrubSound(clip, now, CROSSFADE_S);
  voice = null;
  clip = null;
}

function startVoice(ctx: AudioContext, source: AudioBuffer, time: number, rate: number, now: number): void {
  fadeOutAll(now);
  const sound = startScrubSound(ctx, {
    buffer: source,
    offset: time,
    at: now,
    volume: targetVolume(),
    rate,
    fadeS: CROSSFADE_S,
  });
  const started: Voice = { sound, position: time, rate, updatedAt: now };
  sound.source.onended = () => {
    if (voice !== started) return;
    voice = null;
    activeSnippet = null;
  };
  voice = started;
  ensureWatchdog();
}

function steerVoice(running: Voice, rate: number, now: number): void {
  running.position = voicePosition(running, now);
  running.updatedAt = now;
  running.rate = rate;
  running.sound.source.playbackRate.setTargetAtTime(rate, now, RATE_SMOOTHING_S);
  retargetScrubSoundVolume(running.sound, now, targetVolume(), CROSSFADE_S);
}

function playClip(ctx: AudioContext, source: AudioBuffer, time: number, now: number): void {
  fadeOutAll(now);
  const sound = startScrubSound(ctx, {
    buffer: source,
    offset: time,
    at: now,
    volume: targetVolume(),
    rate: 1,
    fadeS: CROSSFADE_S,
    lengthS: SNIPPET_S,
  });
  sound.source.onended = () => {
    if (clip !== sound) return;
    clip = null;
    activeSnippet = null;
  };
  clip = sound;
}

// -- Watchdog -----------------------------------------------------------------

function releaseWatchdogFrames(): void {
  releaseWatchdog?.();
  releaseWatchdog = null;
}

// A frame callback must never write to a store: this one only touches audio nodes and module state.
function stopHeldVoice(nowMs: number): void {
  if (!voice) {
    releaseWatchdogFrames();
    return;
  }
  if (nowMs - lastPlayAtMs <= stopAfterMs) return;
  fadeOutScrubSound(voice.sound, scheduleTime(sharedAudioContext()), CROSSFADE_S);
  voice = null;
  activeSnippet = null;
  releaseWatchdogFrames();
}

function ensureWatchdog(): void {
  if (releaseWatchdog) return;
  const releaseHold = holdFrames(FRAME_LABEL);
  const unsubscribe = subscribeFrame(stopHeldVoice, FRAME_LABEL);
  // Hidden tabs pause animation frames, so the watchdog alone would let a voice play on.
  const stopWhenHidden = () => {
    if (document.hidden) stop();
  };
  document.addEventListener("visibilitychange", stopWhenHidden);
  releaseWatchdog = () => {
    document.removeEventListener("visibilitychange", stopWhenHidden);
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

  const ctx = getContext();
  const now = scheduleTime(ctx);
  const nowMs = performance.now();
  const clampedTime = Math.max(0, Math.min(time, Math.max(0, buffer.duration - SNIPPET_S)));
  const intervalMs = nowMs - lastPlayAtMs;
  const measured = intervalMs >= MIN_SPEED_INTERVAL_MS && intervalMs <= MAX_SPEED_INTERVAL_MS;
  const speed = measured ? (clampedTime - previousTime) / (intervalMs / 1000) : velocity;
  stopAfterMs = measured ? Math.max(MIN_STOP_AFTER_MS, 2 * intervalMs) : MIN_STOP_AFTER_MS;

  const step = scrubStep(voice ? voicePosition(voice, now) : null, clampedTime, furthestTime, speed);
  if (step.kind === "clip") playClip(ctx, buffer, clampedTime, now);
  else if (step.kind === "steer" && voice) steerVoice(voice, step.rate, now);
  else startVoice(ctx, buffer, clampedTime, step.rate, now);

  furthestTime = furthestTimeAfter(step, furthestTime, clampedTime);
  previousTime = clampedTime;
  lastPlayAtMs = nowMs;
  activeSnippet = { time: clampedTime, rate: velocity };
}

function stop(): void {
  pendingSnippet = null;
  if (voice || clip) fadeOutAll(scheduleTime(sharedAudioContext()));
  releaseWatchdogFrames();
  activeSnippet = null;
  previousTime = Number.NEGATIVE_INFINITY;
  furthestTime = Number.NEGATIVE_INFINITY;
  lastPlayAtMs = Number.NEGATIVE_INFINITY;
}

function getActiveSnippet(): ActiveSnippet | null {
  return activeSnippet;
}

// -- Exports ------------------------------------------------------------------

const scrubPreview = { useBuffer, useLazyBuffer, play, stop, getActiveSnippet };

export { scrubPreview };
