import { releaseSpectrumAnalysis } from "@/views/timeline/spectrum/use-spectrum-session";
import { closeWaveformCache, openWaveformCache } from "@/views/timeline/waveform-data-cache";
import { useEffect } from "react";

// -- Hooks ---------------------------------------------------------------------

// The editor screen owns these lifetimes: leaving it for the Library or Unison releases them, a tab switch never does.
// The cache closes rather than only clearing, because the waveform's destroy can run after this cleanup.
function useReleaseTimelineCachesWithEditor(): void {
  useEffect(() => {
    openWaveformCache();
    return () => {
      releaseSpectrumAnalysis();
      closeWaveformCache();
    };
  }, []);
}

// -- Exports -------------------------------------------------------------------

export { useReleaseTimelineCachesWithEditor };
