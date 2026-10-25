import type { PitchJob, PitchJobResult } from "@/audio/pitch/pitch-worker";
import { SWIFT_F0_HOP, SWIFT_F0_SAMPLE_RATE } from "@/domain/pitch/swift-f0-frames";
import type { PitchTrack } from "@/domain/pitch/track";

// -- Functions ----------------------------------------------------------------

// One worker per job so an abort terminates it outright; audio16k is transferred, so pass a buffer you own.
function detectPitchOffThread(audio16k: Float32Array, signal: AbortSignal): Promise<PitchTrack> {
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pitch-worker.ts", import.meta.url), { type: "module" });
    const finish = () => {
      worker.terminate();
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      finish();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    worker.addEventListener("message", ({ data }: MessageEvent<PitchJobResult>) => {
      finish();
      if (data.type === "error") {
        reject(new Error(data.message));
        return;
      }
      resolve({
        hopSeconds: SWIFT_F0_HOP / SWIFT_F0_SAMPLE_RATE,
        startSeconds: 0,
        frequencyHz: data.frequencyHz,
        confidencePercent: data.confidencePercent,
        loudnessDb: data.loudnessDb,
      });
    });
    worker.addEventListener("error", (event) => {
      finish();
      reject(new Error(event.message || "Pitch worker failed."));
    });
    signal.addEventListener("abort", onAbort, { once: true });
    const job: PitchJob = { audio16k };
    worker.postMessage(job, [audio16k.buffer]);
  });
}

// -- Exports ------------------------------------------------------------------

export { detectPitchOffThread };
