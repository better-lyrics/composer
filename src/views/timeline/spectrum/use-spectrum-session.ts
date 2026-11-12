import { fetchVocalStem } from "@/audio/separation/fetch-vocal-stem";
import { resolveAnalysis } from "@/domain/spectrum/analysis-window";
import { playableFile, useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { fileIdentityKey } from "@/utils/file-identity";
import {
  type SpectrumRun,
  type SpectrumTarget,
  forgetSpectrumAudio,
  startSpectrumRun,
} from "@/views/timeline/spectrum/spectrum-run";
import { clearSpectrumSession, spectrumSession } from "@/views/timeline/spectrum/spectrum-session";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect } from "react";

// -- State --------------------------------------------------------------------

let activeRun: SpectrumRun | null = null;
let appliedKey: string | null = null;
let stopWatchingHidden: (() => void) | null = null;

// -- Functions ----------------------------------------------------------------

function desiredTarget(): SpectrumTarget | null {
  if (!useSettingsStore.getState().showSpectrum) return null;
  const { spectrumSource, spectrumWindow } = useSettingsStore.getState();
  const { stemUrls, jobKey } = useSeparationStore.getState();
  const vocalsUrl = stemUrls.vocals ?? null;
  const analysis = resolveAnalysis(spectrumSource, spectrumWindow, vocalsUrl !== null);
  if (analysis.source === "vocals" && vocalsUrl && jobKey) {
    return { ...analysis, sourceKey: `vocals:${vocalsUrl}`, audio: () => fetchVocalStem(vocalsUrl), jobKey };
  }
  const file = playableFile(useAudioStore.getState().source);
  if (!file) return null;
  return { ...analysis, sourceKey: `mix:${fileIdentityKey(file)}`, audio: file, jobKey };
}

function targetKey(target: SpectrumTarget | null): string | null {
  return target ? `${target.sourceKey}|${target.fftSize}|${target.jobKey}` : null;
}

function dropAnalysis(): void {
  activeRun?.cancel();
  activeRun = null;
  appliedKey = null;
  clearSpectrumSession();
}

function stopWatchingWhileHidden(): void {
  stopWatchingHidden?.();
  stopWatchingHidden = null;
}

// Hidden, the band keeps its analysis until what it would analyse changes.
function watchWhileHidden(): void {
  const check = () => {
    if (targetKey(desiredTarget()) === appliedKey) return;
    dropAnalysis();
    stopWatchingWhileHidden();
  };
  const unsubscribes = [
    useSettingsStore.subscribe(check),
    useSeparationStore.subscribe(check),
    useAudioStore.subscribe((state, prev) => {
      if (state.source !== prev.source) check();
    }),
  ];
  stopWatchingHidden = () => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  };
}

function releaseSpectrumAnalysis(): void {
  stopWatchingWhileHidden();
  dropAnalysis();
  forgetSpectrumAudio();
}

function focusTime(): number {
  const { scrollLeft, zoom } = useTimelineStore.getState();
  return zoom > 0 ? scrollLeft / zoom : 0;
}

function requestSpectrumRawPhase(chunks: readonly number[]): boolean {
  if (!activeRun) return false;
  activeRun.requestRawPhase(chunks);
  return true;
}

// The only driver of spectrum analysis: it follows visibility, source, window and stem job.
function useSpectrumSession(): void {
  useEffect(() => {
    stopWatchingWhileHidden();

    const sync = () => {
      const target = desiredTarget();
      const key = targetKey(target);
      if (key === appliedKey && spectrumSession.status !== "error") return;
      dropAnalysis();
      if (!target) return;
      activeRun = startSpectrumRun(target, focusTime());
      appliedKey = key;
    };

    sync();
    activeRun?.setFocusTime(focusTime());
    activeRun?.setShown(true);
    const unsubscribeTimeline = useTimelineStore.subscribe((state, prev) => {
      if (state.scrollLeft !== prev.scrollLeft || state.zoom !== prev.zoom) activeRun?.setFocusTime(focusTime());
    });
    const unsubscribeSettings = useSettingsStore.subscribe((state, prev) => {
      if (
        state.showSpectrum !== prev.showSpectrum ||
        state.spectrumSource !== prev.spectrumSource ||
        state.spectrumWindow !== prev.spectrumWindow
      ) {
        sync();
      }
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
      activeRun?.setShown(false);
      if (appliedKey !== null) watchWhileHidden();
    };
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { releaseSpectrumAnalysis, requestSpectrumRawPhase, useSpectrumSession };
