/// <reference lib="webworker" />
import { type Backend, type Ort, type OrtSession, createSession, loadOrt } from "@/audio/ort-runtime";
import { chooseBackend, runnableVariant } from "@/audio/separation/backend-selection";
import { runChunkPipeline } from "@/audio/separation/chunk-pipeline";
import { type Chunk, chunkCount, stitchChunks } from "@/audio/separation/chunker";
import { denormalizeDemucsOutput, normalizeForDemucs } from "@/audio/separation/demucs-postprocess";
import { fetchAndCacheModel, hasCachedModel, readCachedModel } from "@/audio/separation/model-cache";
import { type ModelDescriptor, getModelDescriptor } from "@/audio/separation/model-registry";
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
let loadedModel: ModelDescriptor | null = null;

function post(message: OutboundMessage, transfer?: Transferable[]) {
  self.postMessage(message, transfer ?? []);
}

const cancelHandlers = new Set<() => void>();

// Resolves null once it has posted the error or the cancellation.
async function loadModelBytes(descriptor: ModelDescriptor): Promise<ArrayBuffer | null> {
  if (await hasCachedModel(descriptor)) {
    const cached = await readCachedModel(descriptor);
    if (!cached) {
      post({ type: "error", code: "fetch-failed", message: "Model cache hit but read failed." });
      return null;
    }
    post({ type: "init-progress", loaded: cached.byteLength, total: cached.byteLength });
    return cached;
  }
  const ac = new AbortController();
  const onCancel = () => ac.abort();
  cancelHandlers.add(onCancel);
  try {
    return await fetchAndCacheModel(descriptor, ac.signal, (loaded, total) => {
      post({ type: "init-progress", loaded, total });
    });
  } catch (err) {
    if (cancelled || (err as Error)?.name === "AbortError") {
      post({ type: "cancelled" });
    } else {
      post({ type: "error", code: "fetch-failed", message: (err as Error).message });
    }
    return null;
  } finally {
    cancelHandlers.delete(onCancel);
  }
}

async function handleInit(variant: VocalModelVariant, forceWasm?: boolean, profile?: boolean) {
  cancelled = false;
  profileGpu = profile ?? false;

  // Pick the backend before the download so a variant it can't run is swapped for fp32 first.
  const choice = await chooseBackend(forceWasm);
  if (choice.backend === "webgpu") {
    log(`using WebGPU (${choice.adapterLabel})`);
  } else {
    log(`using WASM (CPU): ${choice.reason}`);
  }
  const runnable = runnableVariant(variant, choice);
  if (runnable.fallbackReason) log(runnable.fallbackReason);
  let descriptor = getModelDescriptor(runnable.variant);
  if (!descriptor) {
    post({ type: "error", code: "no-base-url", message: "VITE_VOCAL_MODEL_BASE_URL is not configured." });
    return;
  }
  let modelBytes = await loadModelBytes(descriptor);
  if (!modelBytes) return;

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
    if (activeBackend === "webgpu") {
      try {
        session = await createSession(runtime, modelBytes, "webgpu");
      } catch (err) {
        log(`WebGPU session creation failed (${describeError(err)}); falling back to WASM (CPU)`);
        activeBackend = "wasm";
      }
    }
    if (activeBackend === "wasm") {
      const onWasm = runnableVariant(descriptor.variant, { backend: "wasm", reason: "WebGPU fallback" });
      if (onWasm.variant !== descriptor.variant) {
        log(onWasm.fallbackReason);
        descriptor = getModelDescriptor(onWasm.variant) ?? descriptor;
        modelBytes = await loadModelBytes(descriptor);
        if (!modelBytes) return;
      }
      session = await createSession(runtime, modelBytes, "wasm");
    }
    ort = runtime;
    loadedModel = descriptor;
    post({ type: "init-done" });
  } catch (err) {
    log("init failed:", err);
    post({ type: "error", code: "ort-failed", message: describeError(err) });
  }
}

// Resolves null when cancelled; each await is a point where a cancel can arrive. This keeps the loaded
// model even if it is fp16: switching to fp32 here would mean a download in the middle of the run.
async function recreateSessionOnWasm(
  gpuSession: OrtSession,
  runtime: Ort,
  gpuError: unknown,
): Promise<OrtSession | null> {
  const modelBytes = loadedModel && (await readCachedModel(loadedModel));
  if (!modelBytes) throw gpuError;
  await gpuSession.release?.().catch((err: unknown) => log("releasing the WebGPU session failed:", err));
  session = null;
  if (cancelled) return null;
  activeBackend = "wasm";
  const wasmSession = await createSession(runtime, modelBytes, "wasm");
  if (!cancelled) return wasmSession;
  await wasmSession.release?.().catch((err: unknown) => log("releasing the WASM session failed:", err));
  return null;
}

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

  const separate = (activeSession: OrtSession, runtime: Ort) =>
    runChunkPipeline({
      session: activeSession,
      runtime,
      channels: normalized.channels,
      totalChunks,
      backend: activeBackend,
      profileGpu,
      adapterHasTimestampQuery,
      isCancelled: () => cancelled,
      onProgress: (processed, total) => post({ type: "process-progress", processed, total }),
    });

  let vocalChunks: Chunk[];
  try {
    let result: Awaited<ReturnType<typeof runChunkPipeline>>;
    try {
      result = await separate(session, ort);
    } catch (err) {
      if (activeBackend === "wasm") throw err;
      if (cancelled) {
        result = { status: "cancelled" };
      } else {
        // A GPU without enough memory for the model fails inside run(), after the session was created.
        log(`WebGPU inference failed (${describeError(err)}); retrying on WASM (CPU)`);
        session = await recreateSessionOnWasm(session, ort, err);
        result = session ? await separate(session, ort) : { status: "cancelled" };
      }
    }
    if (result.status === "cancelled") {
      post({ type: "cancelled" });
      return;
    }
    vocalChunks = result.chunks;
  } catch (err) {
    if (cancelled) {
      post({ type: "cancelled" });
      return;
    }
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
    await session?.release?.();
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
