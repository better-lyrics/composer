import type { PitchWorkerRequest, PitchWorkerResult } from "@/audio/pitch/pitch-worker";
import { STREAM_WINDOW_FRAMES, SWIFT_F0_HOP, SWIFT_F0_SAMPLE_RATE } from "@/domain/pitch/swift-f0-frames";
import type { PitchTrack } from "@/domain/pitch/track";

// -- Types --------------------------------------------------------------------

interface PitchDetection {
  setFocusTime(seconds: number): void;
  done: Promise<PitchTrack>;
}

interface PitchDetectionOptions {
  focusTime: number;
  signal: AbortSignal;
  // The track is filled in place as windows arrive: unvoiced until its window lands.
  onProgress: (track: PitchTrack) => void;
}

// -- Constants ----------------------------------------------------------------

const HOP_SECONDS = SWIFT_F0_HOP / SWIFT_F0_SAMPLE_RATE;

// -- Functions ----------------------------------------------------------------

function windowAt(seconds: number): number {
  return Math.max(0, Math.floor(seconds / HOP_SECONDS / STREAM_WINDOW_FRAMES));
}

// One worker per detection so an abort terminates it outright; audio16k is transferred, so pass a buffer you own.
function startPitchDetection(audio16k: Float32Array, options: PitchDetectionOptions): PitchDetection {
  const worker = new Worker(new URL("./pitch-worker.ts", import.meta.url), { type: "module" });
  const send = (request: PitchWorkerRequest, transfer: Transferable[] = []) => worker.postMessage(request, transfer);
  const done = new Promise<PitchTrack>((resolve, reject) => {
    let track: PitchTrack | null = null;
    const finish = () => {
      worker.terminate();
      options.signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      finish();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    if (options.signal.aborted) return onAbort();
    worker.addEventListener("message", ({ data }: MessageEvent<PitchWorkerResult>) => {
      if (data.type === "frames") {
        track = {
          hopSeconds: HOP_SECONDS,
          startSeconds: 0,
          frequencyHz: new Float32Array(data.frameCount),
          confidencePercent: new Uint8Array(data.frameCount),
          loudnessDb: data.loudnessDb,
        };
      } else if (data.type === "window" && track) {
        track.frequencyHz.set(data.frequencyHz, data.outputFrom);
        track.confidencePercent.set(data.confidencePercent, data.outputFrom);
        options.onProgress(track);
      } else if (data.type === "done" && track) {
        finish();
        resolve(track);
      } else if (data.type === "error") {
        finish();
        reject(new Error(data.message));
      }
    });
    worker.addEventListener("error", (event) => {
      finish();
      reject(new Error(event.message || "Pitch worker failed."));
    });
    options.signal.addEventListener("abort", onAbort, { once: true });
  });
  send({ type: "start", audio16k, focusWindow: windowAt(options.focusTime) }, [audio16k.buffer]);
  return { setFocusTime: (seconds) => send({ type: "focus", window: windowAt(seconds) }), done };
}

// -- Exports ------------------------------------------------------------------

export { startPitchDetection };
export type { PitchDetection };
