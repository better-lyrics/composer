import { useFrameLoop } from "@/hooks/use-frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";
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
    if (!element || !audio) return;
    // A playhead drag only seeks on release, so the preview follows the dragged time meanwhile.
    const { isDraggingPlayhead, dragTime } = useTimelineStore.getState();
    apply(element, audio, isDraggingPlayhead ? dragTime : audio.currentTime);
  }, label);
}

// -- Exports ------------------------------------------------------------------

export { useRendererAudioSync };
