/// <reference lib="webworker" />
import { type Ort, loadOrt } from "@/audio/ort-runtime";
import { getModelBaseUrl } from "@/audio/separation/model-registry";
import { demixPlan } from "@/audio/separation/roformer/demix";
import { DspLane } from "@/audio/separation/roformer/dsp-lane";
import type { PreparedChunk } from "@/audio/separation/roformer/dsp-worker";
import { roformerParts } from "@/audio/separation/roformer/model-parts";
import {
  type SessionChain,
  loadSessionChain,
  releaseSessionChain,
  runSessionChain,
} from "@/audio/separation/roformer/session-chain";
import { describeError, log } from "@/audio/separation/worker-log";

declare const self: DedicatedWorkerGlobalScope;

// -- Types --------------------------------------------------------------------

type InboundMessage =
  | { type: "init"; seq: number }
  | { type: "process"; seq: number; channels: Float32Array[]; totalFrames: number }
  | { type: "release"; seq: number }
  | { type: "cancel" };

type OutboundMessage =
  | { type: "progress"; seq: number; loaded: number; total: number }
  | { type: "done"; seq: number; vocals?: Float32Array[]; stats?: SeparationStats }
  | { type: "cancelled"; seq: number }
  | { type: "error"; seq: number; code: string; message: string };

type Request = Exclude<InboundMessage, { type: "cancel" }>;

/** Where a song's time went, in ms. `chain` is the time the 14 graphs were running, upload and readback included. */
interface SeparationStats {
  chunks: number;
  wall: number;
  /** Until the first chunk's features were ready. */
  startup: number;
  /** From the first chunk's chain starting to the last one ending. */
  gpu: number;
  chain: number;
  /** The GPU waiting on the CPU: for the next chunk's features, and for the mixer to catch up. */
  featureWait: number;
  mixWait: number;
  /** Mixing the last chunks after the GPU was done. */
  drain: number;
}

// -- Constants ----------------------------------------------------------------

// Chunks prepared ahead of the GPU, and chunks handed to the mixer but not yet mixed. Each holds about 38 MB.
const PREPARE_AHEAD = 2;
const MIX_BACKLOG = 2;

// -- State --------------------------------------------------------------------

let runtime: Ort | null = null;
let chain: SessionChain | null = null;
let deviceLost: string | null = null;
// A cancel stops whatever was sent before it, running or queued, and nothing sent after it.
let cancelEpoch = 0;
let queue: Promise<void> = Promise.resolve();

// -- Helpers ------------------------------------------------------------------

function post(message: OutboundMessage, transfer: Transferable[] = []) {
  self.postMessage(message, transfer);
}

function ignore() {}

// -- Requests -----------------------------------------------------------------

// The sessions stay loaded between songs: building them again in the same tab would briefly hold two copies.
async function init(seq: number, isCancelled: () => boolean): Promise<void> {
  if (deviceLost) throw new Error(`The GPU stopped responding (${deviceLost}).`);
  if (chain) {
    post({ type: "done", seq });
    return;
  }
  const baseUrl = getModelBaseUrl();
  if (!baseUrl) throw Object.assign(new Error("VITE_VOCAL_MODEL_BASE_URL is not configured."), { code: "no-base-url" });
  runtime ??= await loadOrt("webgpu", false);
  const controller = new AbortController();
  const watch = setInterval(() => isCancelled() && controller.abort(), 250);
  try {
    chain = await loadSessionChain(runtime, roformerParts(baseUrl), {
      signal: controller.signal,
      onProgress: (loaded, total) => post({ type: "progress", seq, loaded, total }),
    });
  } finally {
    clearInterval(watch);
  }
  chain.device.lost.then((info) => {
    deviceLost = `${info.reason}: ${info.message}`;
    log(`WebGPU device lost (${deviceLost})`);
  });
  post({ type: "done", seq });
}

// The GPU runs one chunk at a time. Two DSP workers keep its next input ready and mix its last output back, so this
// thread does nothing synchronous between graphs and the GPU never waits on the CPU unless the CPU is the slower.
async function separate(
  seq: number,
  channels: Float32Array[],
  frames: number,
  isCancelled: () => boolean,
): Promise<{ vocals: Float32Array[]; stats: SeparationStats } | null> {
  const ort = runtime;
  const sessions = chain;
  if (!sessions || !ort) throw new Error("The vocal model isn't loaded.");
  if (channels.length !== 2) throw new Error(`The vocal model needs stereo input (got ${channels.length} channels).`);
  const count = demixPlan(frames).starts.length;
  const preparer = new DspLane("roformer-prepare");
  const mixer = new DspLane("roformer-mix");
  const started = performance.now();
  const stats: SeparationStats = {
    chunks: count,
    wall: 0,
    startup: 0,
    gpu: 0,
    chain: 0,
    featureWait: 0,
    mixWait: 0,
    drain: 0,
  };
  // Every promise gets a handler when it's made: a failure surfaces at the next await, or from `failure()`.
  const prepared = new Map<number, Promise<PreparedChunk>>();
  const ask = (index: number) => {
    if (index >= count) return;
    const chunk = preparer.prepare(index);
    chunk.catch(ignore);
    prepared.set(index, chunk);
  };
  const mixes: Promise<void>[] = [];
  const failure = () => preparer.error ?? mixer.error;
  try {
    log(`separating ${count} chunks with Mel-Band RoFormer`);
    await Promise.all([preparer.loadSong(channels, frames), mixer.beginMix(frames, channels.length)]);
    for (let i = 0; i < PREPARE_AHEAD; i++) ask(i);
    let gpuStarted = 0;
    for (let k = 0; k < count; k++) {
      const waitStart = performance.now();
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one chunk on the GPU at a time
      const chunk = await (prepared.get(k) as Promise<PreparedChunk>);
      prepared.delete(k);
      const chainStart = performance.now();
      if (k === 0) {
        stats.startup = chainStart - started;
        gpuStarted = chainStart;
      } else stats.featureWait += chainStart - waitStart;
      ask(k + PREPARE_AHEAD);
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one chunk on the GPU at a time
      const masks = await runSessionChain(ort, sessions, chunk.features, isCancelled);
      stats.chain += performance.now() - chainStart;
      if (!masks || isCancelled()) return null;
      if (deviceLost) throw new Error(`The GPU stopped responding (${deviceLost}).`);
      const err = failure();
      if (err) throw err;
      if (k >= MIX_BACKLOG) {
        const mixWaitStart = performance.now();
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- bounds the chunks waiting to be mixed
        await mixes[k - MIX_BACKLOG];
        stats.mixWait += performance.now() - mixWaitStart;
      }
      const mixed = mixer
        .mix(k, chunk.length, chunk.specs, masks)
        .then(() => post({ type: "progress", seq, loaded: k + 1, total: count }));
      mixed.catch(ignore);
      mixes.push(mixed);
    }
    const gpuDone = performance.now();
    stats.gpu = gpuDone - gpuStarted;
    await Promise.all(mixes);
    const vocals = await mixer.endMix();
    const ended = performance.now();
    stats.drain = ended - gpuDone;
    stats.wall = ended - started;
    log(
      `separated ${count} chunks in ${(stats.wall / 1000).toFixed(1)} s: ${(stats.gpu / count).toFixed(0)} ms a chunk, ` +
        `the graphs running ${((100 * stats.chain) / stats.gpu).toFixed(1)}% of that; waited ${stats.featureWait.toFixed(0)} ms ` +
        `for features and ${stats.mixWait.toFixed(0)} ms for the mixer; ${stats.startup.toFixed(0)} ms to start, ` +
        `${stats.drain.toFixed(0)} ms to finish`,
    );
    return { vocals, stats };
  } finally {
    preparer.terminate();
    mixer.terminate();
  }
}

async function handle(request: Request, isCancelled: () => boolean): Promise<void> {
  const { seq } = request;
  try {
    if (request.type === "init") await init(seq, isCancelled);
    else if (request.type === "release") {
      if (chain) await releaseSessionChain(chain.sessions);
      chain = null;
      post({ type: "done", seq });
    } else {
      const result = await separate(seq, request.channels, request.totalFrames, isCancelled);
      if (!result) post({ type: "cancelled", seq });
      else
        post(
          { type: "done", seq, ...result },
          result.vocals.map((c) => c.buffer),
        );
    }
  } catch (err) {
    if (isCancelled()) {
      post({ type: "cancelled", seq });
      return;
    }
    log(`${request.type} failed:`, err);
    const code = (err as { code?: unknown }).code;
    post({ type: "error", seq, code: typeof code === "string" ? code : "ort-failed", message: describeError(err) });
  }
}

self.addEventListener("message", (ev: MessageEvent<InboundMessage>) => {
  const msg = ev.data;
  if (msg.type === "cancel") {
    cancelEpoch += 1;
    return;
  }
  const epoch = cancelEpoch;
  queue = queue.then(() => handle(msg, () => epoch !== cancelEpoch));
});

export type { InboundMessage, OutboundMessage, SeparationStats };
