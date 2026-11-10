import { useTimelineStore } from "@/views/timeline/timeline-store";
import { scrollView } from "@/views/timeline/view-scroll";
import { applyWaveformZoom } from "@/views/timeline/waveform-zoom";

// -- Functions -----------------------------------------------------------------

// WaveSurfer redraws for the new zoom and scroll before React renders the zoom, so its layout reads find a clean tree.
function zoomView(container: HTMLElement, zoom: number, scrollLeft: number): void {
  useTimelineStore.getState().setZoom(zoom);
  scrollView(container, scrollLeft);
  applyWaveformZoom();
}

// -- Exports -------------------------------------------------------------------

export { zoomView };
