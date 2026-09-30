import type { Bounds } from "@/domain/word/bounds";

// -- Types --------------------------------------------------------------------

interface SoloEndStep {
  seekTo: number;
  pause: boolean;
}

// -- Constants ----------------------------------------------------------------

const END_TOLERANCE_SECONDS = 0.005;

// -- Functions ----------------------------------------------------------------

function isAtEnd(time: number, bounds: Bounds): boolean {
  return time >= bounds.end - END_TOLERANCE_SECONDS;
}

function soloPlayStart(time: number, bounds: Bounds): number | null {
  return time < bounds.begin || isAtEnd(time, bounds) ? bounds.begin : null;
}

function soloPlaybackEnd(time: number, bounds: Bounds, loop: boolean): SoloEndStep | null {
  return isAtEnd(time, bounds) ? { seekTo: bounds.begin, pause: !loop } : null;
}

function isOutsideSolo(time: number, bounds: Bounds): boolean {
  return time < bounds.begin - END_TOLERANCE_SECONDS || time > bounds.end + END_TOLERANCE_SECONDS;
}

// -- Exports ------------------------------------------------------------------

export { isOutsideSolo, soloPlaybackEnd, soloPlayStart };
