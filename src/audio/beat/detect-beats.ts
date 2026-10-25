import { BEAT_SAMPLE_RATE } from "@/audio/beat/beat-features";
import type { BeatDetectionErrorCode, BeatWorkerEvent, BeatWorkerRequest } from "@/audio/beat/beat-worker-messages";
import { decodeFileToFloat32 } from "@/audio/separation/audio-codec";
import type { DetectedBeats } from "@/domain/tempo/beat-grid";

// -- Types ---------------------------------------------------------------------

interface DetectBeatsOptions {
  source: Blob;
  signal: AbortSignal;
  onDownloadProgress: (loaded: number, total: number) => void;
  onDetectProgress: (done: number, total: number) => void;
  forceWasm?: boolean;
}

type BeatDetectionError = Error & { code: BeatDetectionErrorCode | "decode-failed" };

// -- Helpers -------------------------------------------------------------------

function detectionError(code: BeatDetectionError["code"], message: string): BeatDetectionError {
  return Object.assign(new Error(message), { code });
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

async function decodeMono(source: Blob): Promise<Float32Array> {
  try {
    const { channels } = await decodeFileToFloat32(source, { sampleRate: BEAT_SAMPLE_RATE });
    const mono = new Float32Array(channels[0]?.length ?? 0);
    for (const channel of channels) {
      for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / channels.length;
    }
    return mono;
  } catch (error) {
    throw detectionError("decode-failed", (error as Error).message);
  }
}

// -- Detection -----------------------------------------------------------------

async function detectBeats(options: DetectBeatsOptions): Promise<DetectedBeats> {
  const { source, signal, onDownloadProgress, onDetectProgress, forceWasm } = options;
  signal.throwIfAborted();
  const mono = await decodeMono(source);
  signal.throwIfAborted();
  const worker = new Worker(new URL("./beat-worker.ts", import.meta.url), { type: "module" });
  try {
    return await new Promise<DetectedBeats>((resolve, reject) => {
      signal.addEventListener("abort", () => reject(abortError()), { once: true });
      worker.addEventListener("error", (event) => reject(detectionError("ort-failed", event.message)));
      worker.addEventListener("message", ({ data }: MessageEvent<BeatWorkerEvent>) => {
        if (data.type === "download-progress") onDownloadProgress(data.loaded, data.total);
        else if (data.type === "detect-progress") onDetectProgress(data.done, data.total);
        else if (data.type === "done") resolve({ beats: data.beats, downbeats: data.downbeats });
        else reject(detectionError(data.code, data.message));
      });
      const request: BeatWorkerRequest = { signal: mono, forceWasm };
      worker.postMessage(request, [mono.buffer]);
    });
  } finally {
    worker.terminate();
  }
}

// -- Exports -------------------------------------------------------------------

export { detectBeats };
export type { BeatDetectionError, DetectBeatsOptions };
