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

let loaded: Ort | null = null;

// Injected by Vite from the installed onnxruntime-web package. The WASM/JSEP
// loader files fetched from the CDN must match the bundled JS exactly.
function getOrtVersion(): string {
  return import.meta.env.VITE_ORT_VERSION;
}

async function loadOrt(backend: Backend, profile: boolean): Promise<Ort> {
  if (loaded) return loaded;
  const mod = backend === "wasm" ? await import("onnxruntime-web") : await import("onnxruntime-web/webgpu");
  const candidate = (mod as unknown as { default?: Ort }).default ?? (mod as unknown as Ort);
  candidate.env.wasm.numThreads = 1;
  candidate.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${getOrtVersion()}/dist/`;
  // Ask for the discrete GPU on hybrid-graphics machines. chooseBackend probes
  // with the same options, so its verdict matches the adapter ORT will get.
  if (candidate.env.webgpu) candidate.env.webgpu.powerPreference = WEBGPU_POWER_PREFERENCE;
  // Opt-in: per-kernel GPU timestamps (ns). Left "off" here and switched on for
  // a single chunk by the pipeline: ORT's standard timestamp-query mode ends a
  // compute pass per kernel, which makes profiled runs many times slower.
  if (profile && candidate.env.webgpu) {
    candidate.env.webgpu.profiling = { mode: "off", ondata: recordKernel };
  }
  loaded = candidate;
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
