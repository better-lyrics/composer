import type { GuideSignal } from "@/domain/guide/model";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useGuideStore } from "@/stores/guide";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { type SettingsState, useSettingsStore } from "@/stores/settings";
import { useEffect } from "react";

// -- Types --------------------------------------------------------------------

interface GuideStateSnapshot {
  settings: SettingsState;
  hasVocals: boolean;
  hearingStem: boolean;
  hasBeatGrid: boolean;
}

// -- Constants ----------------------------------------------------------------

// A feature you already have on counts as learned, whichever way you turned it on. Defaults that are on
// from the start count only once they do something: onsets need the vocal, the beat grid needs a grid.
const ON_STATE_SIGNALS: readonly [GuideSignal, (state: GuideStateSnapshot) => boolean][] = [
  ["timeline.spectrum", ({ settings }) => settings.showSpectrum],
  ["timeline.pitch", ({ settings, hasVocals }) => hasVocals && settings.pitchLine !== "off"],
  ["timeline.onsets", ({ settings, hasVocals }) => hasVocals && settings.vocalOnsetSnap],
  ["timeline.beats", ({ settings, hasBeatGrid }) => hasBeatGrid && settings.beatGridVisible],
  ["timeline.stems", ({ hearingStem }) => hearingStem],
  ["preview.sidebar", ({ settings }) => settings.previewSidebar],
];

// -- Helpers ------------------------------------------------------------------

function learnWhatIsOn(): void {
  const separation = useSeparationStore.getState();
  const snapshot: GuideStateSnapshot = {
    settings: useSettingsStore.getState(),
    hasVocals: Boolean(separation.stemUrls.vocals),
    hearingStem: separation.currentStem !== "original",
    hasBeatGrid: useProjectStore.getState().beatGrid !== null,
  };
  const { learnedSignals } = useGuideStore.getState();
  for (const [signal, isOn] of ON_STATE_SIGNALS) {
    if (!learnedSignals.includes(signal) && isOn(snapshot)) noteGuideSignal(signal);
  }
}

// -- Hook ---------------------------------------------------------------------

function useGuideStateLearning(): void {
  useEffect(() => {
    learnWhatIsOn();
    const stops = [
      useSettingsStore.subscribe(learnWhatIsOn),
      useSeparationStore.subscribe(learnWhatIsOn),
      useProjectStore.subscribe((state, previous) => {
        if (state.beatGrid !== previous.beatGrid) learnWhatIsOn();
      }),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useGuideStateLearning };
