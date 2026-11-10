import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Interfaces ----------------------------------------------------------------

type ApplyWaveformZoom = (zoom: number) => void;

// -- State ---------------------------------------------------------------------

let applyZoom: ApplyWaveformZoom | null = null;
let zoomQueued = false;

// -- Functions -----------------------------------------------------------------

function applyLatestZoom(): void {
  zoomQueued = false;
  applyZoom?.(useTimelineStore.getState().zoom);
}

// Subscribed at import, ahead of every component: the microtask runs after the zoom writer's scroll and before React commits the zoom.
useTimelineStore.subscribe((state, previous) => {
  if (state.zoom === previous.zoom || applyZoom === null || zoomQueued) return;
  zoomQueued = true;
  queueMicrotask(applyLatestZoom);
});

function followWaveformZoom(apply: ApplyWaveformZoom): () => void {
  applyZoom = apply;
  return () => {
    if (applyZoom === apply) applyZoom = null;
  };
}

// -- Exports -------------------------------------------------------------------

export { followWaveformZoom };
