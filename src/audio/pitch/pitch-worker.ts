/// <reference lib="webworker" />
// biome-ignore organizeImports: the webworker triple-slash reference must stay before imports.
import { loadOrt } from "@/audio/ort-runtime";
import { type PitchFrames, inferPitchFrames } from "@/audio/pitch/swift-f0-inference";

declare const self: DedicatedWorkerGlobalScope;

// -- Types --------------------------------------------------------------------

interface PitchJob {
  audio16k: Float32Array;
}

type PitchJobResult = ({ type: "pitch" } & PitchFrames) | { type: "error"; message: string };

// -- Constants ----------------------------------------------------------------

const MODEL_URL = "/models/swift-f0/model.onnx";

// -- Detection ----------------------------------------------------------------

async function readModel(): Promise<ArrayBuffer> {
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`Could not load the pitch model (${response.status}).`);
  return response.arrayBuffer();
}

// The model is too small to gain from WebGPU, so it always runs on WASM.
async function detectPitch({ audio16k }: PitchJob): Promise<PitchFrames> {
  const ort = await loadOrt(true);
  const session = await ort.InferenceSession.create(await readModel(), {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  try {
    return await inferPitchFrames(ort, session, audio16k);
  } finally {
    await session.release?.();
  }
}

self.addEventListener("message", (event: MessageEvent<PitchJob>) => {
  detectPitch(event.data).then(
    (frames) => {
      const result: PitchJobResult = { type: "pitch", ...frames };
      self.postMessage(result, [frames.frequencyHz.buffer, frames.confidencePercent.buffer, frames.loudnessDb.buffer]);
    },
    (error: unknown) => {
      const result: PitchJobResult = { type: "error", message: error instanceof Error ? error.message : String(error) };
      self.postMessage(result);
    },
  );
});

// -- Exports ------------------------------------------------------------------

export type { PitchJob, PitchJobResult };
