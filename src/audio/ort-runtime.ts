import { recordKernel } from "@/audio/separation/gpu-profile";

type Backend = "webgpu" | "wasm";

interface OrtTensor {
  data: Float32Array;
  dims: number[];
  /** Frees a tensor ORT left on the GPU (preferredOutputLocation "gpu-buffer"). */
  dispose?(): void;
}

type ExecutionProvider = string | { name: "webgpu"; storageBufferCacheMode?: "bucket" | "simple" | "disabled" };

interface SessionOptions {
  executionProviders: ExecutionProvider[];
  graphOptimizationLevel?: string;
  preferredOutputLocation?: "cpu" | "gpu-buffer";
}

interface GpuDeviceLike {
  queue: { onSubmittedWorkDone(): Promise<void> };
  lost: Promise<{ reason: string; message: string }>;
  destroy(): void;
}

interface OrtSession {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
  release?(): Promise<void>;
}

interface Ort {
  InferenceSession: {
    create(bytes: ArrayBuffer | Uint8Array, opts: SessionOptions): Promise<OrtSession>;
  };
  Tensor: {
    new (dtype: "float32", data: Float32Array, dims: number[]): OrtTensor;
    new (dtype: "int64", data: BigInt64Array, dims: number[]): OrtTensor;
  };
  env: {
    wasm: { wasmPaths?: string; numThreads?: number };
    webgpu?: {
      powerPreference?: "high-performance" | "low-power";
      /** The device ORT created; resolves once a WebGPU session exists. */
      device?: Promise<GpuDeviceLike>;
      profiling?: {
        mode?: "off" | "default";
        ondata?: (data: { programName?: string; startTime: number; endTime: number }) => void;
      };
    };
  };
}

const WEBGPU_POWER_PREFERENCE = "high-performance";

const loaded: Partial<Record<Backend, Ort>> = {};
// Reading ORT's device before its first WebGPU session would create one, so the device is only read once a session was tried.
let webGpuSessionTried = false;

// The CDN WASM/JSEP loader files must match the bundled JS version exactly.
function getOrtVersion(): string {
  return __ORT_VERSION__;
}

async function loadOrt(backend: Backend, profile: boolean): Promise<Ort> {
  const cached = loaded[backend];
  if (cached) return cached;
  const mod = backend === "wasm" ? await import("onnxruntime-web") : await import("onnxruntime-web/webgpu");
  const candidate = (mod as unknown as { default?: Ort }).default ?? (mod as unknown as Ort);
  candidate.env.wasm.numThreads = 1;
  candidate.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${getOrtVersion()}/dist/`;
  // Discrete GPU on hybrid graphics; chooseBackend probes with the same options.
  if (candidate.env.webgpu) candidate.env.webgpu.powerPreference = WEBGPU_POWER_PREFERENCE;
  // Switched on for one chunk by the pipeline: timestamp-query mode makes profiled runs much slower.
  if (profile && candidate.env.webgpu) {
    candidate.env.webgpu.profiling = { mode: "off", ondata: recordKernel };
  }
  loaded[backend] = candidate;
  return candidate;
}

function createSession(runtime: Ort, modelBytes: ArrayBuffer, backend: Backend): Promise<OrtSession> {
  if (backend === "webgpu") webGpuSessionTried = true;
  return runtime.InferenceSession.create(modelBytes, {
    executionProviders: backend === "webgpu" ? ["webgpu", "wasm"] : ["wasm"],
    graphOptimizationLevel: "all",
  });
}

// One graph of a model split into consecutive sessions: every output but the last stays on the GPU for the next part,
// and the bucket cache recycles the parts' intermediate buffers.
function createChainedWebGpuSession(
  runtime: Ort,
  modelBytes: Uint8Array,
  keepOutputOnGpu: boolean,
): Promise<OrtSession> {
  webGpuSessionTried = true;
  return runtime.InferenceSession.create(modelBytes, {
    executionProviders: [{ name: "webgpu", storageBufferCacheMode: "bucket" }],
    graphOptimizationLevel: "all",
    preferredOutputLocation: keepOutputOnGpu ? "gpu-buffer" : "cpu",
  });
}

// Chrome 152 to 158 deadlock the whole tab when a GPU reply arrives while a worker waits on the GPU
// (crbug.com/574515421). Releasing a model and ending a worker both wait on it, so before a worker ends, the GPU
// finishes its work, the sessions are released one at a time, and the device is destroyed: nothing is left to reply.
async function releaseWebGpu(runtime: Ort | null, sessions: readonly (OrtSession | null)[]): Promise<void> {
  try {
    const device = webGpuSessionTried && runtime?.env.webgpu?.device ? await runtime.env.webgpu.device : null;
    await device?.queue.onSubmittedWorkDone();
    for (const session of sessions) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- releasing them together floods the GPU
      await session?.release?.();
    }
    if (!device) return;
    await device.queue.onSubmittedWorkDone();
    device.destroy();
    await device.lost;
  } catch (err) {
    console.warn("[ort-runtime] couldn't release WebGPU cleanly before the worker ends", err);
  }
}

export { WEBGPU_POWER_PREFERENCE, createChainedWebGpuSession, createSession, loadOrt, releaseWebGpu };
export type { Backend, GpuDeviceLike, Ort, OrtSession, OrtTensor };
