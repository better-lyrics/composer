import type { BeatDetectionStatus } from "@/stores/beat-detection";

// -- Types ---------------------------------------------------------------------

interface DetectionProgress {
  status: BeatDetectionStatus;
  loaded: number;
  total: number;
  done: number;
  chunks: number;
}

// -- Progress ------------------------------------------------------------------

function isDetectionRunning(status: BeatDetectionStatus): boolean {
  return status === "downloading" || status === "detecting";
}

function detectionPercent({ status, loaded, total, done, chunks }: DetectionProgress): number {
  const [part, whole] = status === "downloading" ? [loaded, total] : [done, chunks];
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// -- Exports -------------------------------------------------------------------

export { detectionPercent, isDetectionRunning };
