import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions -----------------------------------------------------------------

// Measured in timeline time, not pixels, so a scroll or zoom mid-gesture keeps the edge under the pointer.
function pointerTravelSeconds(track: Element, startClientX: number): (clientX: number) => number {
  const contentOriginX = track.getBoundingClientRect().left + useTimelineStore.getState().scrollLeft;
  const pointerTime = (clientX: number) => {
    const { scrollLeft, zoom } = useTimelineStore.getState();
    return (clientX - contentOriginX + scrollLeft) / zoom;
  };
  const startTime = pointerTime(startClientX);
  return (clientX) => pointerTime(clientX) - startTime;
}

// -- Exports -------------------------------------------------------------------

export { pointerTravelSeconds };
