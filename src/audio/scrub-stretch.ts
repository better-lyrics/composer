import type { StretchNode } from "signalsmith-stretch";
import stretchWorkletUrl from "signalsmith-stretch?url";
import { sharedAudioContext } from "@/audio/shared-audio-context";

// -- Types --------------------------------------------------------------------

interface Stretch {
  node: StretchNode;
  gain: GainNode;
}

interface ScrubMove {
  buffer: AudioBuffer;
  time: number;
  rate: number;
  volume: number;
}

// -- Constants ----------------------------------------------------------------

const BLOCK_MS = 60;
const FOLLOW_S = 0.05;
const SCRUB_HOLD_S = 0.12;
const JUMP_S = 0.5;
const MAX_RATE = 4;
const FADE_S = 0.01;
const LOG_PREFIX = "[ScrubStretch]";

// -- State --------------------------------------------------------------------

let stretchPromise: Promise<Stretch> | null = null;
let loadedBuffer: AudioBuffer | null = null;
let loading: Promise<void> = Promise.resolve();
let latestRequest = 0;
let segment = { input: 0, at: 0, rate: 0 };
let lastMoveTime = Number.NaN;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

// -- Functions ----------------------------------------------------------------

// The worklet loads the untouched library file: the bundled copy rebuilds its worklet from Function.toString,
// which bundler rewrites break.
function createStretch(): Promise<Stretch> {
  stretchPromise ??= import("signalsmith-stretch")
    .then(({ default: SignalsmithStretch }) => {
      SignalsmithStretch.moduleUrl = stretchWorkletUrl;
      return SignalsmithStretch(sharedAudioContext());
    })
    .then((node) => {
      void node.configure({ blockMs: BLOCK_MS });
      const gain = new GainNode(node.context, { gain: 0 });
      node.connect(gain).connect(node.context.destination);
      return { node, gain };
    })
    .catch((err: unknown) => {
      stretchPromise = null;
      throw err;
    });
  return stretchPromise;
}

// The node keeps its own copy of the samples, so it is loaded once per buffer and dropped when the buffer goes.
// A failed load is logged and forgotten so the next call retries; `loading` itself never rejects.
function loadInto(node: StretchNode, buffer: AudioBuffer | null): Promise<void> {
  if (loadedBuffer === buffer) return loading;
  loadedBuffer = buffer;
  const channels = buffer
    ? Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index))
    : [];
  loading = loading
    .then(() => node.dropBuffers())
    .then(() => (channels.length > 0 ? node.addBuffers(channels) : 0))
    .then(
      () => undefined,
      (err: unknown) => {
        if (loadedBuffer === buffer) loadedBuffer = null;
        console.warn(LOG_PREFIX, "could not load audio for scrub preview", err);
      },
    );
  return loading;
}

function useStretchBuffer(buffer: AudioBuffer | null): void {
  latestRequest += 1;
  if (!buffer && !stretchPromise) return;
  createStretch()
    .then(({ node }) => loadInto(node, buffer))
    .catch((err: unknown) => console.warn(LOG_PREFIX, "could not create the scrub preview node", err));
}

function fadeOut({ node, gain }: Stretch, at: number): void {
  if (stopTimer !== null) clearTimeout(stopTimer);
  gain.gain.cancelScheduledValues(at);
  gain.gain.setTargetAtTime(0, at, FADE_S / 3);
  const delayMs = (at - node.context.currentTime + FADE_S) * 1000;
  stopTimer = setTimeout(() => {
    stopTimer = null;
    void node.schedule({ active: false });
  }, delayMs);
}

// The audio is time-stretched, so the pitch never changes. While it is sounding, each move steers the speed so the
// audio catches up with the playhead over FOLLOW_S instead of jumping. The speed never goes negative, so a backward
// move restarts at the playhead and the song never plays reversed. Changes are scheduled for now only: the node
// treats a future change as current. A playhead that stops keeps sounding for SCRUB_HOLD_S.
function applyMove(stretch: Stretch, move: ScrubMove): void {
  const { node, gain } = stretch;
  const now = node.context.currentTime;
  const expected = segment.input + (now - segment.at) * segment.rate;
  const forward = !(move.time < lastMoveTime);
  lastMoveTime = move.time;
  if (stopTimer !== null && forward && Math.abs(move.time - expected) < JUMP_S) {
    const rate = Math.max(0, Math.min(MAX_RATE, move.rate + (move.time - expected) / FOLLOW_S));
    void node.schedule({ rate, active: true });
    segment = { input: expected, at: now, rate };
  } else {
    void node.schedule({ input: move.time, rate: move.rate, active: true });
    segment = { input: move.time, at: now, rate: move.rate };
  }
  gain.gain.cancelScheduledValues(now);
  gain.gain.setTargetAtTime(move.volume, now, FADE_S / 3);
  fadeOut(stretch, now + SCRUB_HOLD_S);
}

function scrubTo(move: ScrubMove): void {
  latestRequest += 1;
  const request = latestRequest;
  createStretch()
    .then(async (stretch) => {
      await loadInto(stretch.node, move.buffer);
      if (request === latestRequest) applyMove(stretch, move);
    })
    .catch((err: unknown) => console.warn(LOG_PREFIX, "could not start scrub preview", err));
}

function silenceStretch(): void {
  latestRequest += 1;
  const request = latestRequest;
  if (!stretchPromise || stopTimer === null) return;
  stretchPromise
    .then((stretch) => {
      if (request === latestRequest) fadeOut(stretch, stretch.node.context.currentTime);
    })
    .catch((err: unknown) => console.warn(LOG_PREFIX, "could not stop scrub preview", err));
}

// -- Exports ------------------------------------------------------------------

export { SCRUB_HOLD_S, scrubTo, silenceStretch, useStretchBuffer };
