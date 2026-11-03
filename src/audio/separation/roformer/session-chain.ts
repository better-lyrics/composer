import {
  type GpuDeviceLike,
  type Ort,
  type OrtSession,
  type OrtTensor,
  createChainedWebGpuSession,
} from "@/audio/ort-runtime";
import { type CachedModel, fetchAndCacheModel, readCachedModel } from "@/audio/separation/model-cache";
import { RF_FRAMES } from "@/audio/separation/roformer/spec";

// -- Types --------------------------------------------------------------------

interface SessionChain {
  sessions: OrtSession[];
  device: GpuDeviceLike;
}

interface LoadOptions {
  signal: AbortSignal;
  onProgress: (loaded: number, total: number) => void;
}

// -- Loading ------------------------------------------------------------------

async function readPart(
  part: CachedModel,
  options: LoadOptions,
  onBytes: (loaded: number) => void,
): Promise<Uint8Array> {
  const cached = await readCachedModel(part);
  if (cached) {
    onBytes(cached.byteLength);
    return new Uint8Array(cached);
  }
  return new Uint8Array(await fetchAndCacheModel(part, options.signal, onBytes));
}

// Each graph's session is created as soon as its bytes arrive, and the bytes are dropped, so the download never
// holds the whole model in memory beside the sessions.
async function loadSessionChain(
  runtime: Ort,
  parts: readonly CachedModel[],
  options: LoadOptions,
): Promise<SessionChain> {
  const total = parts.reduce((sum, part) => sum + part.approxBytes, 0);
  const sessions: OrtSession[] = [];
  let done = 0;
  try {
    for (const [index, part] of parts.entries()) {
      options.signal.throwIfAborted();
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one graph in memory at a time
      const bytes = await readPart(part, options, (loaded) => options.onProgress(done + loaded, total));
      options.signal.throwIfAborted();
      sessions.push(await createChainedWebGpuSession(runtime, bytes, index < parts.length - 1));
      done += part.approxBytes;
    }
    const device = await runtime.env.webgpu?.device;
    if (!device) throw new Error("ORT didn't expose its WebGPU device.");
    return { sessions, device };
  } catch (err) {
    await releaseSessionChain(sessions);
    throw err;
  }
}

async function releaseSessionChain(sessions: readonly OrtSession[]): Promise<void> {
  await Promise.all(sessions.map((session) => session.release?.()));
}

// -- Running ------------------------------------------------------------------

// Every graph's output but the last stays on the GPU. ORT submits a run without waiting for the GPU, and the
// buffers it releases are reclaimed only once the GPU catches up, so waiting after each graph keeps the next
// graph from piling its buffers on top: without the wait the model runs out of memory on an integrated GPU.
async function runSessionChain(
  runtime: Ort,
  chain: SessionChain,
  features: Float32Array,
  isCancelled: () => boolean,
): Promise<Float32Array | null> {
  let input: OrtTensor = new runtime.Tensor("float32", features, [1, RF_FRAMES, features.length / RF_FRAMES]);
  for (const [index, session] of chain.sessions.entries()) {
    let outputs: Record<string, OrtTensor>;
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each graph feeds the next
      outputs = await session.run({ [session.inputNames[0]]: input });
    } finally {
      if (index > 0) input.dispose?.();
    }
    await chain.device.queue.onSubmittedWorkDone();
    input = outputs[session.outputNames[0]];
    if (index < chain.sessions.length - 1 && isCancelled()) {
      input.dispose?.();
      return null;
    }
  }
  return input.data;
}

// -- Exports ------------------------------------------------------------------

export { loadSessionChain, releaseSessionChain, runSessionChain };
export type { SessionChain };
