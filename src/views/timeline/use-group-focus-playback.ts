import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { currentEffectiveFocus, useEffectiveFocus } from "@/views/timeline/effective-focus";
import { focusBounds } from "@/views/timeline/group-focus";
import { soloPlayStart, soloPlaybackEnd } from "@/views/timeline/solo-playback";
import { useEffect } from "react";

// -- Helpers ------------------------------------------------------------------

function currentSoloBounds() {
  const focus = currentEffectiveFocus();
  return focus ? focusBounds(useProjectStore.getState().lines, focus) : null;
}

// -- Hook ---------------------------------------------------------------------

// Keeps playback inside the open instance: play starts at its first word, and its end stops or loops.
function useGroupFocusPlayback(): void {
  const isOpen = useEffectiveFocus() !== null;
  const audio = useAudioStore((s) => s.audioElement);

  useEffect(() => {
    if (!isOpen || !audio) return;
    let endTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleEnd = () => {
      clearTimeout(endTimer);
      const bounds = currentSoloBounds();
      if (!bounds || audio.paused) return;
      const delayMs = Math.max(0, ((bounds.end - audio.currentTime) / audio.playbackRate) * 1000);
      endTimer = setTimeout(checkEnd, delayMs);
    };

    const checkEnd = () => {
      const bounds = currentSoloBounds();
      if (!bounds || audio.paused) return;
      const step = soloPlaybackEnd(audio.currentTime, bounds, useSettingsStore.getState().loopOpenGroup);
      if (!step) {
        scheduleEnd();
        return;
      }
      const store = useAudioStore.getState();
      if (step.pause) store.setIsPlaying(false);
      store.seekTo(step.seekTo);
    };

    const handlePlay = () => {
      const bounds = currentSoloBounds();
      const start = bounds ? soloPlayStart(audio.currentTime, bounds) : null;
      if (start !== null) useAudioStore.getState().seekTo(start);
      scheduleEnd();
    };

    if (!audio.paused) handlePlay();
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("seeked", scheduleEnd);
    audio.addEventListener("ratechange", scheduleEnd);
    audio.addEventListener("timeupdate", checkEnd);
    return () => {
      clearTimeout(endTimer);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("seeked", scheduleEnd);
      audio.removeEventListener("ratechange", scheduleEnd);
      audio.removeEventListener("timeupdate", checkEnd);
    };
  }, [isOpen, audio]);
}

// -- Exports ------------------------------------------------------------------

export { useGroupFocusPlayback };
