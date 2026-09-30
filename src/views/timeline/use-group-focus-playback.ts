import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { currentEffectiveFocus, useEffectiveFocus } from "@/views/timeline/effective-focus";
import { focusBounds } from "@/views/timeline/group-focus";
import { isOutsideSolo, soloPlayStart, soloPlaybackEnd } from "@/views/timeline/solo-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect } from "react";

// -- Helpers ------------------------------------------------------------------

function currentSoloBounds() {
  const focus = currentEffectiveFocus();
  return focus ? focusBounds(useProjectStore.getState().lines, focus) : null;
}

// -- Hook ---------------------------------------------------------------------

// Keeps playback inside the open instance: play starts at its first word, the end stops or loops, and a seek outside
// it ends the solo.
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

    const handleSeeked = () => {
      const bounds = currentSoloBounds();
      if (bounds && isOutsideSolo(audio.currentTime, bounds)) {
        useTimelineStore.getState().closeGroup();
        return;
      }
      scheduleEnd();
    };

    if (!audio.paused) handlePlay();
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("ratechange", scheduleEnd);
    audio.addEventListener("timeupdate", checkEnd);
    return () => {
      clearTimeout(endTimer);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("ratechange", scheduleEnd);
      audio.removeEventListener("timeupdate", checkEnd);
    };
  }, [isOpen, audio]);
}

// -- Exports ------------------------------------------------------------------

export { useGroupFocusPlayback };
