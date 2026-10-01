/// <reference lib="webworker" />
// biome-ignore organizeImports: the webworker triple-slash reference must stay before imports.
import { detectVocalOnsets, mixToMono } from "@/audio/onset-detection";
import { encodeWav } from "@/audio/wav-encode";

declare const self: DedicatedWorkerGlobalScope;

// -- Types --------------------------------------------------------------------

type PcmJob =
  | { type: "detect-onsets"; channels: Float32Array[]; sampleRate: number }
  | { type: "encode-wav"; channels: Float32Array[]; sampleRate: number };

type PcmJobResult =
  | { type: "onsets"; onsets: number[] }
  | { type: "wav"; bytes: ArrayBuffer }
  | { type: "error"; message: string };

// -- Jobs ---------------------------------------------------------------------

function runJob(job: PcmJob): { result: PcmJobResult; transfer: Transferable[] } {
  if (job.type === "encode-wav") {
    const bytes = encodeWav(job.channels, job.sampleRate);
    return { result: { type: "wav", bytes }, transfer: [bytes] };
  }
  const onsets = detectVocalOnsets(mixToMono(job.channels), { sampleRate: job.sampleRate });
  return { result: { type: "onsets", onsets }, transfer: [] };
}

self.addEventListener("message", (event: MessageEvent<PcmJob>) => {
  try {
    const { result, transfer } = runJob(event.data);
    self.postMessage(result, transfer);
  } catch (error) {
    const result: PcmJobResult = { type: "error", message: error instanceof Error ? error.message : String(error) };
    self.postMessage(result);
  }
});

// -- Exports ------------------------------------------------------------------

export type { PcmJob, PcmJobResult };
