import { clampSpectrumBandHeight } from "@/domain/spectrum/settings";
import { useSettingsStore } from "@/stores/settings";
import { WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions ----------------------------------------------------------------

function overviewBandHeight(spectrumVisible: boolean, storedSpectrumHeight: number): number {
  return spectrumVisible ? clampSpectrumBandHeight(storedSpectrumHeight) : WAVEFORM_HEIGHT;
}

// While the band animates to a new height the rows follow its animated min-height, so read that when mounted.
function currentOverviewBandHeight(): number {
  const band = document.querySelector<HTMLElement>("[data-overview-band]");
  if (band) return Number.parseFloat(getComputedStyle(band).minHeight) || WAVEFORM_HEIGHT;
  return overviewBandHeight(
    useTimelineStore.getState().spectrumVisible,
    useSettingsStore.getState().spectrumBandHeight,
  );
}

function useOverviewBandHeight(): number {
  const visible = useTimelineStore((s) => s.spectrumVisible);
  const stored = useSettingsStore((s) => s.spectrumBandHeight);
  return overviewBandHeight(visible, stored);
}

// -- Exports ------------------------------------------------------------------

export { currentOverviewBandHeight, useOverviewBandHeight };
