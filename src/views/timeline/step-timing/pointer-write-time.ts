import { livePlaybackTime } from "@/stores/audio";
import { xToTime } from "@/views/timeline/coords";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { readViewScroll } from "@/views/timeline/view-scroll";

// -- State --------------------------------------------------------------------

let bandPointer: { clientX: number; container: HTMLElement } | null = null;

// -- Functions ----------------------------------------------------------------

function trackBandPointer(clientX: number, container: HTMLElement): void {
  bandPointer = { clientX, container };
}

function clearBandPointer(): void {
  bandPointer = null;
}

function bandPointerTime(): number | null {
  if (!bandPointer) return null;
  const { container, clientX } = bandPointer;
  return xToTime(
    clientX,
    container.getBoundingClientRect(),
    useTimelineStore.getState().zoom,
    readViewScroll(container).left,
  );
}

function stepWriteTime(): number {
  return bandPointerTime() ?? livePlaybackTime();
}

// -- Exports ------------------------------------------------------------------

export { bandPointerTime, clearBandPointer, stepWriteTime, trackBandPointer };
