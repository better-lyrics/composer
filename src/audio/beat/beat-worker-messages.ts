// -- Types ---------------------------------------------------------------------

type BeatDetectionErrorCode = "fetch-failed" | "ort-failed";

interface BeatWorkerRequest {
  signal: Float32Array;
  forceWasm?: boolean;
}

type BeatWorkerEvent =
  | { type: "download-progress"; loaded: number; total: number }
  | { type: "detect-progress"; done: number; total: number }
  | { type: "done"; beats: number[]; downbeats: number[] }
  | { type: "error"; code: BeatDetectionErrorCode; message: string };

// -- Exports -------------------------------------------------------------------

export type { BeatDetectionErrorCode, BeatWorkerEvent, BeatWorkerRequest };
