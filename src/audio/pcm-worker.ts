/// <reference lib="webworker" />
// biome-ignore organizeImports: the webworker triple-slash reference must stay before imports.
import { detectVocalOnsets, mixToMono } from "@/audio/onset-detection";

declare const self: DedicatedWorkerGlobalScope;

// -- Types --------------------------------------------------------------------

type PcmJob = { type: "detect-onsets"; channels: Float32Array[]; sampleRate: number };

type PcmJobResult = { type: "onsets"; onsets: number[] } | { type: "error"; message: string };

// -- Jobs ---------------------------------------------------------------------

function runJob(job: PcmJob): PcmJobResult {
  return { type: "onsets", onsets: detectVocalOnsets(mixToMono(job.channels), { sampleRate: job.sampleRate }) };
}

self.addEventListener("message", (event: MessageEvent<PcmJob>) => {
  try {
    self.postMessage(runJob(event.data));
  } catch (error) {
    const result: PcmJobResult = { type: "error", message: error instanceof Error ? error.message : String(error) };
    self.postMessage(result);
  }
});

// -- Exports ------------------------------------------------------------------

export type { PcmJob, PcmJobResult };
