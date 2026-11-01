import { clampSpectrumBandHeight } from "@/domain/spectrum/settings";
import { useSettingsStore } from "@/stores/settings";
import { WAVEFORM_HEIGHT } from "@/views/timeline/timeline-store";
import { type RefObject, useEffect } from "react";

// -- State --------------------------------------------------------------------

let mountedBand: HTMLElement | null = null;
let bandAnimating = false;
let restingHeight: number | null = null;

// -- Functions ----------------------------------------------------------------

function overviewBandHeight(showSpectrum: boolean, storedSpectrumHeight: number): number {
  return showSpectrum ? clampSpectrumBandHeight(storedSpectrumHeight) : WAVEFORM_HEIGHT;
}

// While the band animates to a new height the rows follow its animated min-height; at rest the style read is skipped.
function currentOverviewBandHeight(): number {
  const target = overviewBandHeight(
    useSettingsStore.getState().showSpectrum,
    useSettingsStore.getState().spectrumBandHeight,
  );
  if (!mountedBand || (!bandAnimating && restingHeight === target)) return target;
  const height = Number.parseFloat(getComputedStyle(mountedBand).minHeight) || WAVEFORM_HEIGHT;
  restingHeight = !bandAnimating && height === target ? target : null;
  return height;
}

function useOverviewBandHeight(): number {
  const visible = useSettingsStore((s) => s.showSpectrum);
  const stored = useSettingsStore((s) => s.spectrumBandHeight);
  return overviewBandHeight(visible, stored);
}

function useMountedOverviewBand(bandRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    const onTransition = (event: TransitionEvent) => {
      if (event.target !== band || event.propertyName !== "min-height") return;
      bandAnimating = event.type === "transitionrun";
      restingHeight = null;
    };
    band.addEventListener("transitionrun", onTransition);
    band.addEventListener("transitionend", onTransition);
    band.addEventListener("transitioncancel", onTransition);
    mountedBand = band;
    bandAnimating = false;
    restingHeight = null;
    return () => {
      band.removeEventListener("transitionrun", onTransition);
      band.removeEventListener("transitionend", onTransition);
      band.removeEventListener("transitioncancel", onTransition);
      if (mountedBand === band) mountedBand = null;
    };
  }, [bandRef]);
}

// -- Exports ------------------------------------------------------------------

export { currentOverviewBandHeight, useMountedOverviewBand, useOverviewBandHeight };
