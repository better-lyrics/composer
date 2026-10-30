import { useSettingsStore } from "@/stores/settings";
import { useSpectrumBlank } from "@/views/timeline/spectrum/spectrum-session";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Hooks ---------------------------------------------------------------------

function useBandEmpty(): boolean {
  const showSpectrum = useSettingsStore((s) => s.showSpectrum);
  const waveformReady = useTimelineStore((s) => s.waveformReady);
  const spectrumBlank = useSpectrumBlank();
  return showSpectrum ? spectrumBlank : !waveformReady;
}

// -- Exports -------------------------------------------------------------------

export { useBandEmpty };
