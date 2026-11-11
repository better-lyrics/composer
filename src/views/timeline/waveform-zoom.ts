import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Interfaces ----------------------------------------------------------------

type ApplyWaveformZoom = (zoom: number) => void;

// -- State ---------------------------------------------------------------------

let applyZoom: ApplyWaveformZoom | null = null;
let zoomQueued = false;

// -- Functions -----------------------------------------------------------------

function applyWaveformZoom(): void {
  applyZoom?.(useTimelineStore.getState().zoom);
}

function applyQueuedZoom(): void {
  zoomQueued = false;
  applyWaveformZoom();
}

// For zoom writers outside zoomView (project restore, group focus); after zoomView the waveform already has the zoom.
useTimelineStore.subscribe((state, previous) => {
  if (state.zoom === previous.zoom || applyZoom === null || zoomQueued) return;
  zoomQueued = true;
  queueMicrotask(applyQueuedZoom);
});

function followWaveformZoom(apply: ApplyWaveformZoom): () => void {
  applyZoom = apply;
  return () => {
    if (applyZoom === apply) applyZoom = null;
  };
}

// -- Exports -------------------------------------------------------------------

export { applyWaveformZoom, followWaveformZoom };
