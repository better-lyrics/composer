// -- Types ---------------------------------------------------------------------

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
  env: { wasm: { wasmPaths?: string; numThreads?: number } };
}

// -- Loading -------------------------------------------------------------------

let loaded: Ort | null = null;

async function loadOrt(forceWasm: boolean | undefined): Promise<Ort> {
  if (loaded) return loaded;
  const mod = forceWasm
    ? await import("onnxruntime-web")
    : await import("onnxruntime-web/webgpu").catch(() => import("onnxruntime-web"));
  const candidate = (mod as unknown as { default?: Ort }).default ?? (mod as unknown as Ort);
  // Threads need cross-origin isolation, which Composer does not have.
  candidate.env.wasm.numThreads = 1;
  candidate.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${__ORT_VERSION__}/dist/`;
  loaded = candidate;
  return candidate;
}

// -- Exports -------------------------------------------------------------------

export { loadOrt };
export type { Ort, OrtSession, OrtTensor };
