/// <reference lib="webworker" />
import { loadOrt } from "@/audio/ort-runtime";
import { inferPitchWindow, pitchRange } from "@/audio/pitch/swift-f0-inference";
import { nextChunk } from "@/domain/spectrum/chunk-order";
import {
  STREAM_WINDOW_FRAMES,
  frameLoudnessDb,
  inferenceWindows,
  silenceMask,
  swiftF0FrameCount,
} from "@/domain/pitch/swift-f0-frames";

declare const self: DedicatedWorkerGlobalScope;

// -- Types --------------------------------------------------------------------

type PitchWorkerRequest =
  | { type: "start"; audio16k: Float32Array; focusWindow: number }
  | { type: "focus"; window: number };

type PitchWorkerResult =
  | { type: "frames"; frameCount: number; loudnessDb: Int16Array }
  | { type: "window"; outputFrom: number; frequencyHz: Float32Array; confidencePercent: Uint8Array }
  | { type: "done" }
  | { type: "error"; message: string };

// -- Constants ----------------------------------------------------------------

const MODEL_URL = "/models/swift-f0/model.onnx";

// -- State --------------------------------------------------------------------

let focus = 0;

// -- Detection ----------------------------------------------------------------

function post(result: PitchWorkerResult, transfer: Transferable[] = []): void {
  self.postMessage(result, transfer);
}

function yieldToMessages(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function readModel(): Promise<ArrayBuffer> {
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`Could not load the pitch model (${response.status}).`);
  return response.arrayBuffer();
}

// Windows run nearest the viewport first, with a yield between them so focus updates reorder the rest.
async function detectPitch(audio16k: Float32Array): Promise<void> {
  const frameCount = swiftF0FrameCount(audio16k.length);
  const silent = silenceMask(audio16k, frameCount);
  post({ type: "frames", frameCount, loudnessDb: frameLoudnessDb(audio16k, frameCount) });
  // The model is too small to gain from WebGPU, so it always runs on WASM.
  const ort = await loadOrt("wasm", false);
  const session = await ort.InferenceSession.create(await readModel(), {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  const range = pitchRange(ort);
  const windows = inferenceWindows(audio16k.length, STREAM_WINDOW_FRAMES);
  const pending = new Set(windows.keys());
  try {
    for (let index = nextChunk(pending, focus); index !== null; index = nextChunk(pending, focus)) {
      pending.delete(index);
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one session runs one window at a time
      const pitch = await inferPitchWindow(ort, session, range, audio16k, windows[index]);
      const confidencePercent = Uint8Array.from(pitch.confidence, (value, offset) =>
        silent[pitch.outputFrom + offset] ? 0 : Math.round(value * 100),
      );
      post({ type: "window", outputFrom: pitch.outputFrom, frequencyHz: pitch.frequencyHz, confidencePercent }, [
        pitch.frequencyHz.buffer,
        confidencePercent.buffer,
      ]);
      await yieldToMessages();
    }
  } finally {
    await session.release?.();
  }
  post({ type: "done" });
}

self.addEventListener("message", (event: MessageEvent<PitchWorkerRequest>) => {
  const request = event.data;
  if (request.type === "focus") {
    focus = request.window;
    return;
  }
  focus = request.focusWindow;
  detectPitch(request.audio16k).catch((error: unknown) =>
    post({ type: "error", message: error instanceof Error ? error.message : String(error) }),
  );
});

// -- Exports ------------------------------------------------------------------

export type { PitchWorkerRequest, PitchWorkerResult };
