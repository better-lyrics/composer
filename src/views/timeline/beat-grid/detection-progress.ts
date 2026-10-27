import type { BeatDetectionStatus } from "@/stores/beat-detection";
import { percent } from "@/utils/percent";

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
  return percent(part, whole);
}

// -- Exports -------------------------------------------------------------------

export { detectionPercent, isDetectionRunning };
