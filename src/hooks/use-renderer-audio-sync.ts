import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useAudioStore } from "@/stores/audio";
import { AUDIO_STORE_PLAYBACK } from "@/views/preview/renderer-playback";
import type { RefObject } from "react";

// -- Hook ---------------------------------------------------------------------

function useRendererAudioSync<T extends HTMLElement>(
  elementRef: RefObject<T | null>,
  apply: (element: T, audio: HTMLAudioElement, timeSeconds: number) => void,
  label: string,
): void {
  useFrameLoop(() => {
    const element = elementRef.current;
    // Re-read the audio element from the store each frame so the loop keeps
    // tracking it after the audio engine tears down and recreates it.
    const audio = useAudioStore.getState().audioElement;
    const sample = AUDIO_STORE_PLAYBACK.sample();
    if (!element || !audio || !sample) return;
    apply(element, audio, sample.currentTime);
  }, label);
}

// -- Exports ------------------------------------------------------------------

export { useRendererAudioSync };
