import { clampSpectrumBandHeight } from "@/domain/spectrum/settings";
import { useSettingsStore } from "@/stores/settings";
import { WAVEFORM_HEIGHT, useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions ----------------------------------------------------------------

function overviewBandHeight(spectrumVisible: boolean, storedSpectrumHeight: number): number {
  return spectrumVisible ? clampSpectrumBandHeight(storedSpectrumHeight) : WAVEFORM_HEIGHT;
}

function currentOverviewBandHeight(): number {
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
