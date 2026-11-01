import { recordKernel } from "@/audio/separation/gpu-profile";

type Backend = "webgpu" | "wasm";

interface OrtTensor {
  data: Float32Array;
  dims: number[];
}

interface OrtSession {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
  release?(): Promise<void>;
}

interface Ort {
  InferenceSession: {
    create(
      bytes: ArrayBuffer | Uint8Array,
      opts: { executionProviders: string[]; graphOptimizationLevel?: string },
    ): Promise<OrtSession>;
  };
  Tensor: new (dtype: "float32", data: Float32Array, dims: number[]) => OrtTensor;
  env: {
    wasm: { wasmPaths?: string; numThreads?: number };
    webgpu?: {
      powerPreference?: "high-performance" | "low-power";
      profiling?: {
        mode?: "off" | "default";
        ondata?: (data: { programName?: string; startTime: number; endTime: number }) => void;
      };
    };
  };
}

const WEBGPU_POWER_PREFERENCE = "high-performance";

const loaded: Partial<Record<Backend, Ort>> = {};

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
  return runtime.InferenceSession.create(modelBytes, {
    executionProviders: backend === "webgpu" ? ["webgpu", "wasm"] : ["wasm"],
    graphOptimizationLevel: "all",
  });
}

export { WEBGPU_POWER_PREFERENCE, createSession, loadOrt };
export type { Backend, Ort, OrtSession, OrtTensor };
