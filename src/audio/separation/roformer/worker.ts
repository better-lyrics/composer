/// <reference lib="webworker" />
import { type Ort, loadOrt } from "@/audio/ort-runtime";
import { getModelBaseUrl } from "@/audio/separation/model-registry";
import { addChunk, chunkAt, demixPlan, demixSum, finishDemix, padSong } from "@/audio/separation/roformer/demix";
import { roformerParts } from "@/audio/separation/roformer/model-parts";
import {
  type SessionChain,
  loadSessionChain,
  releaseSessionChain,
  runSessionChain,
} from "@/audio/separation/roformer/session-chain";
import { bandLayout } from "@/audio/separation/roformer/spec";
import { bandFeatures, chunkSpectrogram, maskedChannels } from "@/audio/separation/roformer/spectral";
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
  | { type: "done"; seq: number; vocals?: Float32Array[] }
  | { type: "cancelled"; seq: number }
  | { type: "error"; seq: number; code: string; message: string };

type Request = Exclude<InboundMessage, { type: "cancel" }>;

// -- State --------------------------------------------------------------------

const layout = bandLayout();
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

// The next chunk's STFT runs while the GPU works on this one, and this chunk's inverse STFT while it works on the next.
async function separate(seq: number, channels: Float32Array[], frames: number, isCancelled: () => boolean) {
  const ort = runtime;
  const sessions = chain;
  if (!sessions || !ort) throw new Error("The vocal model isn't loaded.");
  if (channels.length !== 2) throw new Error(`The vocal model needs stereo input (got ${channels.length} channels).`);
  const plan = demixPlan(frames);
  const padded = padSong(channels, plan.pad);
  const acc = demixSum(padded[0].length, channels.length);
  const prepare = (index: number) => {
    const chunk = chunkAt(padded, plan.starts[index]);
    const specs = chunk.channels.map(chunkSpectrogram);
    return { index, length: chunk.length, specs, features: bandFeatures(specs, layout) };
  };
  const count = plan.starts.length;
  log(`separating ${count} chunks with Mel-Band RoFormer`);
  let current = prepare(0);
  let running = runSessionChain(ort, sessions, current.features, isCancelled);
  for (let k = 0; k < count; k++) {
    const next = k + 1 < count ? prepare(k + 1) : null;
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one chunk on the GPU at a time
    const masks = await running;
    if (!masks || isCancelled()) return null;
    if (deviceLost) throw new Error(`The GPU stopped responding (${deviceLost}).`);
    if (masks.some((v) => !Number.isFinite(v))) throw new Error("The vocal model returned invalid values.");
    const done = current;
    if (next) {
      current = next;
      running = runSessionChain(ort, sessions, next.features, isCancelled);
    }
    addChunk(
      acc,
      maskedChannels(done.specs, masks, layout),
      plan.starts[done.index],
      done.length,
      plan.windows[done.index],
    );
    post({ type: "progress", seq, loaded: k + 1, total: count });
  }
  return finishDemix(acc, plan.pad, frames);
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
      const vocals = await separate(seq, request.channels, request.totalFrames, isCancelled);
      if (!vocals) post({ type: "cancelled", seq });
      else
        post(
          { type: "done", seq, vocals },
          vocals.map((c) => c.buffer),
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

export type { InboundMessage, OutboundMessage };
