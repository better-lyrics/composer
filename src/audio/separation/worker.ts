/// <reference lib="webworker" />
// biome-ignore organizeImports: the webworker triple-slash reference must stay before imports.
import { chooseBackend, describeUnsupportedVariant } from "@/audio/separation/backend-selection";
import { runChunkPipeline } from "@/audio/separation/chunk-pipeline";
import { type Chunk, chunkCount, stitchChunks } from "@/audio/separation/chunker";
import { denormalizeDemucsOutput, normalizeForDemucs } from "@/audio/separation/demucs-postprocess";
import { fetchAndCacheModel, hasCachedModel, readCachedModel } from "@/audio/separation/model-cache";
import { getModelDescriptor } from "@/audio/separation/model-registry";
import { type Backend, type Ort, type OrtSession, createSession, loadOrt } from "@/audio/separation/ort-runtime";
import { describeError, log } from "@/audio/separation/worker-log";
import type { VocalModelVariant } from "@/stores/settings";

declare const self: DedicatedWorkerGlobalScope;

type InboundMessage =
  | { type: "init"; variant: VocalModelVariant; forceWasm?: boolean; profile?: boolean }
  | { type: "process"; channels: Float32Array[]; totalFrames: number }
  | { type: "cancel" };

type OutboundMessage =
  | { type: "init-progress"; loaded: number; total: number }
  | { type: "init-done" }
  | { type: "process-progress"; processed: number; total: number }
  | { type: "process-done"; vocals: Float32Array[]; numChannels: number; totalFrames: number }
  | { type: "cancelled" }
  | { type: "error"; code: string; message: string };

let ort: Ort | null = null;
let session: OrtSession | null = null;
let activeBackend: Backend = "wasm";
let adapterHasTimestampQuery: boolean | null = null;
let cancelled = false;
let profileGpu = false;

function post(message: OutboundMessage, transfer?: Transferable[]) {
  self.postMessage(message, transfer ?? []);
}

async function handleInit(variant: VocalModelVariant, forceWasm?: boolean, profile?: boolean) {
  cancelled = false;
  profileGpu = profile ?? false;
  const descriptor = getModelDescriptor(variant);
  if (!descriptor) {
    post({ type: "error", code: "no-base-url", message: "VITE_VOCAL_MODEL_BASE_URL is not configured." });
    return;
  }

  // Pick the backend first: it is cheap, and it lets us refuse a variant the
  // device cannot run before spending a download on it.
  const choice = await chooseBackend(forceWasm);
  if (choice.backend === "webgpu") {
    log(`using WebGPU (${choice.adapterLabel})`);
  } else {
    log(`using WASM (CPU): ${choice.reason}`);
  }
  const unsupported = describeUnsupportedVariant(variant, choice);
  if (unsupported) {
    log(unsupported);
    post({ type: "error", code: "ort-failed", message: unsupported });
    return;
  }
  if (variant === "fp16" && choice.backend === "wasm") {
    log("fp16 on the WASM (CPU) path is about 4x slower than fp32; consider the fp32 vocal model");
  }

  let modelBytes: ArrayBuffer;
  if (await hasCachedModel(descriptor)) {
    const cached = await readCachedModel(descriptor);
    if (!cached) {
      post({ type: "error", code: "fetch-failed", message: "Model cache hit but read failed." });
      return;
    }
    modelBytes = cached;
    post({ type: "init-progress", loaded: cached.byteLength, total: cached.byteLength });
  } else {
    const ac = new AbortController();
    const onCancel = () => ac.abort();
    cancelHandlers.add(onCancel);
    try {
      modelBytes = await fetchAndCacheModel(descriptor, ac.signal, (loaded, total) => {
        post({ type: "init-progress", loaded, total });
      });
    } catch (err) {
      if (cancelled || (err as Error)?.name === "AbortError") {
        post({ type: "cancelled" });
        return;
      }
      post({ type: "error", code: "fetch-failed", message: (err as Error).message });
      return;
    } finally {
      cancelHandlers.delete(onCancel);
    }
  }

  try {
    activeBackend = choice.backend;
    adapterHasTimestampQuery = choice.backend === "webgpu" ? choice.hasTimestampQuery : null;
    let runtime: Ort;
    try {
      runtime = await loadOrt(choice.backend, profileGpu);
    } catch (err) {
      if (choice.backend === "wasm") throw err;
      log(`WebGPU runtime failed to load (${describeError(err)}); falling back to WASM (CPU)`);
      activeBackend = "wasm";
      runtime = await loadOrt("wasm", profileGpu);
    }
    try {
      session = await createSession(runtime, modelBytes, activeBackend);
    } catch (err) {
      if (activeBackend === "wasm") throw err;
      log(`WebGPU session creation failed (${describeError(err)}); falling back to WASM (CPU)`);
      activeBackend = "wasm";
      session = await createSession(runtime, modelBytes, "wasm");
    }
    ort = runtime;
    post({ type: "init-done" });
  } catch (err) {
    log("init failed:", err);
    post({ type: "error", code: "ort-failed", message: describeError(err) });
  }
}

const cancelHandlers = new Set<() => void>();

async function handleProcess(channels: Float32Array[], totalFrames: number) {
  if (!session || !ort) {
    post({ type: "error", code: "ort-failed", message: "Session not initialized." });
    return;
  }
  if (channels.length !== 2) {
    post({
      type: "error",
      code: "ort-failed",
      message: `HTDemucs requires stereo input (got ${channels.length} channels).`,
    });
    return;
  }
  cancelled = false;
  const totalChunks = chunkCount(totalFrames);
  log(`processing ${totalChunks} chunks on ${activeBackend}`);
  const normalized = normalizeForDemucs(channels, totalFrames);

  let vocalChunks: Chunk[];
  try {
    const result = await runChunkPipeline({
      session,
      runtime: ort,
      channels: normalized.channels,
      totalChunks,
      backend: activeBackend,
      profileGpu,
      adapterHasTimestampQuery,
      isCancelled: () => cancelled,
      onProgress: (processed, total) => post({ type: "process-progress", processed, total }),
    });
    if (result.status === "cancelled") {
      post({ type: "cancelled" });
      return;
    }
    vocalChunks = result.chunks;
  } catch (err) {
    log("processing failed:", err);
    post({ type: "error", code: "ort-failed", message: describeError(err) });
    return;
  }

  const stitched = denormalizeDemucsOutput(stitchChunks(vocalChunks, totalFrames, channels.length), normalized);

  // Drop GPU/CPU resources tied to the model session before we hand the result
  // back. The host terminates the worker immediately after process-done, but
  // releasing the session explicitly also covers the keep-worker-alive case
  // and helps WebGPU EP flush its buffer pool.
  try {
    await session.release?.();
  } catch {}
  session = null;

  const transfers: Transferable[] = stitched.map((c) => c.buffer);
  post(
    {
      type: "process-done",
      vocals: stitched,
      numChannels: channels.length,
      totalFrames,
    },
    transfers,
  );
}

self.addEventListener("message", (ev: MessageEvent<InboundMessage>) => {
  const msg = ev.data;
  if (msg.type === "init") {
    handleInit(msg.variant, msg.forceWasm, msg.profile);
  } else if (msg.type === "process") {
    handleProcess(msg.channels, msg.totalFrames);
  } else if (msg.type === "cancel") {
    cancelled = true;
    for (const h of cancelHandlers) h();
  }
});

export type { InboundMessage, OutboundMessage };
