import { elementXToTime } from "@/views/timeline/coords";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions -----------------------------------------------------------------

// Reads the track's live position, not the store's scrollLeft, which lags a scroll until its event fires.
function pointerTravelSeconds(track: Element, startClientX: number): (clientX: number) => number {
  const startTime = elementXToTime(startClientX, track, useTimelineStore.getState().zoom);
  return (clientX) => elementXToTime(clientX, track, useTimelineStore.getState().zoom) - startTime;
}

// -- Exports -------------------------------------------------------------------

export { pointerTravelSeconds };
