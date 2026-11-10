import { attachRulerLabels, updateRulerGeometry } from "@/views/timeline/ruler-scroll";
import { viewScrollLeft } from "@/views/timeline/view-scroll";
import { useLayoutEffect } from "react";

// -- Hook ----------------------------------------------------------------------

// Layout effects and the observer callback both run before paint, so labels never trail a zoom or a resize.
function useRulerLabels(
  trackRef: React.RefObject<HTMLDivElement | null>,
  hostRef: React.RefObject<HTMLDivElement | null>,
  duration: number,
  zoom: number,
): void {
  useLayoutEffect(() => {
    const track = trackRef.current;
    const host = hostRef.current;
    const lane = track?.parentElement;
    if (!track || !host || !lane) return;
    const detach = attachRulerLabels(track, host, { duration: 0, zoom: 0, laneWidth: window.innerWidth });
    const observer = new ResizeObserver((entries) => {
      updateRulerGeometry(track, { laneWidth: entries[0].contentRect.width }, viewScrollLeft());
    });
    observer.observe(lane);
    return () => {
      observer.disconnect();
      detach();
    };
  }, [trackRef, hostRef]);

  useLayoutEffect(() => {
    if (trackRef.current) updateRulerGeometry(trackRef.current, { duration, zoom }, viewScrollLeft());
  }, [trackRef, duration, zoom]);
}

// -- Exports -------------------------------------------------------------------

export { useRulerLabels };
