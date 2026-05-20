import { useSettingsStore } from "@/stores/settings";

const SNIPPET_S = 0.12;
const CROSSFADE_S = 0.008;
const MIN_AUDIBLE_RATE = 0.1;

type ActiveSnippet = { time: number; rate: number };

let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentGain: GainNode | null = null;
let activeSnippet: ActiveSnippet | null = null;

function getContext(): AudioContext {
  if (!context) context = new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

async function decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getContext();
  // decodeAudioData detaches its input ArrayBuffer in some browsers; copy first
  return await ctx.decodeAudioData(bytes.slice(0));
}

function useBuffer(next: AudioBuffer | null): void {
  stop();
  buffer = next;
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
  return useSettingsStore.getState().audioScrubPreview !== false;
}

function play(time: number, velocity: number): void {
  if (!isEnabled()) return;
  if (!buffer) return;
  if (velocity < MIN_AUDIBLE_RATE) return;

  const ctx = getContext();
  const maxStartTime = Math.max(0, buffer.duration - SNIPPET_S);
  const clampedTime = Math.max(0, Math.min(time, maxStartTime));

  if (currentSource && currentGain) {
    fadeOutAndStop(currentSource, currentGain);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = velocity;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_S);

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
  if (currentSource && currentGain) {
    fadeOutAndStop(currentSource, currentGain);
  }
  currentSource = null;
  currentGain = null;
  activeSnippet = null;
}

function dispose(): void {
  stop();
  buffer = null;
  context = null;
}

function getActiveSnippet(): ActiveSnippet | null {
  return activeSnippet;
}

const scrubPreview = { decode, useBuffer, play, stop, dispose, getActiveSnippet };

export { scrubPreview };
export type { ActiveSnippet };
