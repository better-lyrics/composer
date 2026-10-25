import { resolveAnalysis } from "@/domain/spectrum/analysis-window";
import { playableFile, useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { fileIdentityKey } from "@/utils/file-identity";
import { type SpectrumRun, type SpectrumTarget, startSpectrumRun } from "@/views/timeline/spectrum/spectrum-run";
import { clearSpectrumSession } from "@/views/timeline/spectrum/spectrum-session";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect } from "react";

// -- State --------------------------------------------------------------------

let activeRun: SpectrumRun | null = null;

// -- Functions ----------------------------------------------------------------

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read the vocal stem (${response.status}).`);
  return response.blob();
}

function desiredTarget(): SpectrumTarget | null {
  if (!useTimelineStore.getState().spectrumVisible) return null;
  const { spectrumSource, spectrumWindow } = useSettingsStore.getState();
  const { stemUrls, jobKey } = useSeparationStore.getState();
  const vocalsUrl = stemUrls.vocals ?? null;
  const analysis = resolveAnalysis(spectrumSource, spectrumWindow, vocalsUrl !== null);
  if (analysis.source === "vocals" && vocalsUrl) {
    return { ...analysis, sourceKey: `vocals:${vocalsUrl}`, audio: () => fetchBlob(vocalsUrl), jobKey };
  }
  const file = playableFile(useAudioStore.getState().source);
  if (!file) return null;
  return { ...analysis, sourceKey: `mix:${fileIdentityKey(file)}`, audio: file, jobKey };
}

function focusTime(): number {
  const { scrollLeft, zoom } = useTimelineStore.getState();
  return zoom > 0 ? scrollLeft / zoom : 0;
}

function requestSpectrumRawPhase(chunks: readonly number[]): void {
  activeRun?.requestRawPhase(chunks);
}

// The only driver of spectrum analysis: it follows visibility, source, window and stem job.
function useSpectrumSession(): void {
  useEffect(() => {
    let appliedKey: string | null = null;

    const stop = () => {
      activeRun?.cancel();
      activeRun = null;
    };

    const sync = () => {
      const target = desiredTarget();
      const key = target ? `${target.sourceKey}|${target.fftSize}|${target.jobKey}` : null;
      if (key === appliedKey) return;
      appliedKey = key;
      stop();
      clearSpectrumSession();
      if (target) activeRun = startSpectrumRun(target, focusTime());
    };

    sync();
    const unsubscribeTimeline = useTimelineStore.subscribe((state, prev) => {
      if (state.spectrumVisible !== prev.spectrumVisible) sync();
      else if (state.scrollLeft !== prev.scrollLeft || state.zoom !== prev.zoom) activeRun?.setFocusTime(focusTime());
    });
    const unsubscribeSettings = useSettingsStore.subscribe((state, prev) => {
      if (state.spectrumSource !== prev.spectrumSource || state.spectrumWindow !== prev.spectrumWindow) sync();
    });
    const unsubscribeSeparation = useSeparationStore.subscribe((state, prev) => {
      if (state.stemUrls.vocals !== prev.stemUrls.vocals || state.jobKey !== prev.jobKey) sync();
    });
    const unsubscribeAudio = useAudioStore.subscribe((state, prev) => {
      if (state.source !== prev.source) sync();
    });

    return () => {
      unsubscribeTimeline();
      unsubscribeSettings();
      unsubscribeSeparation();
      unsubscribeAudio();
      stop();
      clearSpectrumSession();
    };
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { requestSpectrumRawPhase, useSpectrumSession };
