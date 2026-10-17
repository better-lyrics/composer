import type { PcmJob, PcmJobResult } from "@/audio/pcm-worker";

// -- Helpers ------------------------------------------------------------------

function abortError(): DOMException {
  return new DOMException("Cancelled", "AbortError");
}

// Each job gets its own worker so an abort can terminate a long job outright.
function runPcmJob(job: PcmJob, transfer: Transferable[], signal?: AbortSignal): Promise<PcmJobResult> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pcm-worker.ts", import.meta.url), { type: "module" });
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      finish();
      reject(abortError());
    };
    worker.addEventListener("message", (event: MessageEvent<PcmJobResult>) => {
      finish();
      resolve(event.data);
    });
    worker.addEventListener("error", (event) => {
      finish();
      reject(new Error(event.message || "Audio worker failed."));
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.postMessage(job, transfer);
  });
}

// -- Jobs ---------------------------------------------------------------------

function channelBuffers(channels: readonly Float32Array[]): Transferable[] {
  return [...new Set(channels.map((channel) => channel.buffer))];
}

async function detectOnsetsOffThread(
  channels: Float32Array[],
  sampleRate: number,
  signal?: AbortSignal,
): Promise<number[]> {
  const result = await runPcmJob({ type: "detect-onsets", channels, sampleRate }, channelBuffers(channels), signal);
  if (result.type === "error") throw new Error(result.message);
  if (result.type !== "onsets") throw new Error(`Unexpected audio worker result: ${result.type}`);
  return result.onsets;
}

async function encodeWavOffThread(channels: Float32Array[], sampleRate: number): Promise<Blob> {
  const result = await runPcmJob({ type: "encode-wav", channels, sampleRate }, channelBuffers(channels));
  if (result.type === "error") throw new Error(result.message);
  if (result.type !== "wav") throw new Error(`Unexpected audio worker result: ${result.type}`);
  return new Blob([result.bytes], { type: "audio/wav" });
}

// -- Exports ------------------------------------------------------------------

export { detectOnsetsOffThread, encodeWavOffThread };
