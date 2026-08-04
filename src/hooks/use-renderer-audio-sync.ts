import { type RefObject, useEffect, useRef } from "react";
import { useAudioStore } from "@/stores/audio";

// -- Constants ----------------------------------------------------------------

/** How far a reading may be carried before the loop waits for a real one instead. */
const MAX_CLOCK_CARRY_MS = 100;

// -- Hook ---------------------------------------------------------------------

/**
 * Drives a lyrics renderer from the audio element, once per frame.
 *
 * `apply` is handed the playback position rather than left to read it, because a
 * media element only refreshes `currentTime` once per presented frame. Several
 * frames in a row therefore read the same value and the word sweep steps instead
 * of gliding, which gets worse the slower the song plays: at 0.25x the clock
 * moves a quarter as far between refreshes. Carrying the last reading forward at
 * the rate it was taken at is what braccato does for a media element it binds
 * itself, and this is the same thing for the clock composer drives.
 */
function useRendererAudioSync<T extends HTMLElement>(
  elementRef: RefObject<T | null>,
  apply: (element: T, audio: HTMLAudioElement, currentTimeSeconds: number) => void,
): void {
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    let frameId: number;
    let anchor: { mediaTimeS: number; frameTimeMs: number; rate: number } | null = null;

    const tick = (frameTimeMs: number) => {
      const element = elementRef.current;
      // Re-read the audio element from the store each frame so the loop keeps
      // tracking it after the audio engine tears down and recreates it.
      const audio = useAudioStore.getState().audioElement;
      if (element && audio) {
        const mediaTimeS = audio.currentTime;
        // A paused clock is not going anywhere, so it is reported as it reads.
        // Scrubbing while paused lands here too, and must not be carried.
        if (audio.paused) {
          anchor = null;
          applyRef.current(element, audio, mediaTimeS);
        } else {
          if (anchor === null || anchor.mediaTimeS !== mediaTimeS) {
            anchor = { mediaTimeS, frameTimeMs, rate: audio.playbackRate };
          }
          const carriedMs = Math.min(Math.max(frameTimeMs - anchor.frameTimeMs, 0), MAX_CLOCK_CARRY_MS);
          applyRef.current(element, audio, anchor.mediaTimeS + (carriedMs * anchor.rate) / 1000);
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [elementRef]);
}

// -- Exports ------------------------------------------------------------------

export { useRendererAudioSync };
