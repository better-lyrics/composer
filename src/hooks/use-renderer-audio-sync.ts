import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useAudioStore } from "@/stores/audio";
import type { RefObject } from "react";

// -- Hook ---------------------------------------------------------------------

function useRendererAudioSync<T extends HTMLElement>(
  elementRef: RefObject<T | null>,
  apply: (element: T, audio: HTMLAudioElement) => void,
  label: string,
): void {
  useFrameLoop(() => {
    const element = elementRef.current;
    // Re-read the audio element from the store each frame so the loop keeps
    // tracking it after the audio engine tears down and recreates it.
    const audio = useAudioStore.getState().audioElement;
    if (element && audio) apply(element, audio);
  }, label);
}

// -- Exports ------------------------------------------------------------------

export { useRendererAudioSync };
