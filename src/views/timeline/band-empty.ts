import { useSettingsStore } from "@/stores/settings";
import { useSpectrumBlank } from "@/views/timeline/spectrum/spectrum-session";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Hooks ---------------------------------------------------------------------

// True while the band has nothing drawn in it: the skeleton shows and markers wait for the waveform or spectrum.
function useBandEmpty(): boolean {
  const showSpectrum = useSettingsStore((s) => s.showSpectrum);
  const waveformReady = useTimelineStore((s) => s.waveformReady);
  const spectrumBlank = useSpectrumBlank();
  return showSpectrum ? spectrumBlank : !waveformReady;
}

// -- Exports -------------------------------------------------------------------

export { useBandEmpty };
