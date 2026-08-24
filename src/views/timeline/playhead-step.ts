import { GUTTER_WIDTH } from "@/views/timeline/timeline-store";

// -- Functions -----------------------------------------------------------------

function steppedTime(current: number, delta: number, duration: number): number {
  const end = Math.max(0, duration);
  return Math.max(0, Math.min(end, current + delta));
}

function viewportSeconds(clientWidth: number, zoom: number): number {
  if (zoom <= 0) return 0;
  return Math.max(0, clientWidth - GUTTER_WIDTH) / zoom;
}

// -- Exports -------------------------------------------------------------------

export { steppedTime, viewportSeconds };
