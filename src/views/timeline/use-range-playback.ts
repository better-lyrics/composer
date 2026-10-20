import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { useEffectiveFocus } from "@/views/timeline/effective-focus";
import {
  currentPlaybackRange,
  currentSelectionBounds,
  stopSelectionPlayback,
} from "@/views/timeline/selection-playback";
import { isOutsideRange, soloPlayStart, soloPlaybackEnd } from "@/views/timeline/solo-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect } from "react";

// -- Helpers ------------------------------------------------------------------

function isPlayingSelection(): boolean {
  return useTimelineStore.getState().selectionPlayback;
}

// -- Hook ---------------------------------------------------------------------

// Keeps playback inside the active range (a played selection, else the open group): its end stops or loops.
function useRangePlayback(): void {
  const groupOpen = useEffectiveFocus() !== null;
  const selectionPlayback = useTimelineStore((s) => s.selectionPlayback);
  const audio = useAudioStore((s) => s.audioElement);
  const active = groupOpen || selectionPlayback;

  useEffect(() => {
    if (!active || !audio) return;
    let endTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleEnd = () => {
      clearTimeout(endTimer);
      const range = currentPlaybackRange();
      if (!range || audio.paused) return;
      const delayMs = Math.max(0, ((range.end - audio.currentTime) / audio.playbackRate) * 1000);
      endTimer = setTimeout(checkEnd, delayMs);
    };

    const checkEnd = () => {
      const range = currentPlaybackRange();
      if (!range || audio.paused) return;
      const step = soloPlaybackEnd(audio.currentTime, range, useSettingsStore.getState().loopRange);
      if (!step) {
        scheduleEnd();
        return;
      }
      const store = useAudioStore.getState();
      if (step.pause) {
        store.setIsPlaying(false);
        if (isPlayingSelection()) stopSelectionPlayback({ pause: false });
      }
      store.seekTo(step.seekTo);
    };

    const handlePlay = () => {
      const range = currentPlaybackRange();
      const start = range ? soloPlayStart(audio.currentTime, range) : null;
      if (start !== null) useAudioStore.getState().seekTo(start);
      scheduleEnd();
    };

    const handleSeeked = () => {
      const range = currentPlaybackRange();
      if (isPlayingSelection() && range && isOutsideRange(audio.currentTime, range)) {
        stopSelectionPlayback({ pause: false });
        return;
      }
      scheduleEnd();
    };

    const unsubscribeSelection = useTimelineStore.subscribe((state, previous) => {
      if (state.selectedWords === previous.selectedWords || !state.selectionPlayback) return;
      if (currentSelectionBounds()) scheduleEnd();
      else stopSelectionPlayback({ pause: true });
    });

    if (!audio.paused) handlePlay();
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("ratechange", scheduleEnd);
    audio.addEventListener("timeupdate", checkEnd);
    return () => {
      clearTimeout(endTimer);
      unsubscribeSelection();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("ratechange", scheduleEnd);
      audio.removeEventListener("timeupdate", checkEnd);
      if (isPlayingSelection()) stopSelectionPlayback({ pause: false });
    };
  }, [active, audio]);
}

// -- Exports ------------------------------------------------------------------

export { useRangePlayback };
