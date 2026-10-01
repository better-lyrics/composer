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

async function detectOnsetsOffThread(
  channels: Float32Array[],
  sampleRate: number,
  signal?: AbortSignal,
): Promise<number[]> {
  const transfer = [...new Set(channels.map((channel) => channel.buffer))];
  const result = await runPcmJob({ type: "detect-onsets", channels, sampleRate }, transfer, signal);
  if (result.type === "error") throw new Error(result.message);
  return result.onsets;
}

// -- Exports ------------------------------------------------------------------

export { detectOnsetsOffThread };
