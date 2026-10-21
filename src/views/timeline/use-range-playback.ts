import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useEffectiveFocus } from "@/views/timeline/effective-focus";
import {
  currentPlaybackRange,
  currentSelectionBounds,
  currentlyLoops,
  stopSelectionPlayback,
} from "@/views/timeline/selection-playback";
import { isOutsideRange, soloPlayStart, soloPlaybackEnd } from "@/views/timeline/solo-playback";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { useEffect } from "react";

// -- Helpers ------------------------------------------------------------------

function isPlayingSelection(): boolean {
  return useTimelineStore.getState().selectionPlayback !== null;
}

// -- Hook ---------------------------------------------------------------------

// Keeps playback inside the active range (a played selection, else the open group) on every tab: its end stops or loops.
function useRangePlayback(): void {
  const groupOpen = useEffectiveFocus() !== null;
  const selectionPlayback = useTimelineStore((s) => s.selectionPlayback !== null);
  const audio = useAudioStore((s) => s.audioElement);
  const active = groupOpen || selectionPlayback;

  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- endTimer is set from nested handlers and cleared in the returned cleanup
  useEffect(() => {
    if (!active || !audio) return;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    let seekPending = false;

    const scheduleEnd = () => {
      clearTimeout(endTimer);
      const range = currentPlaybackRange();
      if (!range || audio.paused) return;
      const delayMs = Math.max(0, ((range.end - audio.currentTime) / audio.playbackRate) * 1000);
      endTimer = setTimeout(checkEnd, delayMs);
    };

    const checkEnd = () => {
      const range = currentPlaybackRange();
      if (!range || audio.paused || seekPending) return;
      const step = soloPlaybackEnd(audio.currentTime, range, currentlyLoops());
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

    // Chrome fires a timeupdate at the seek target before seeked, with audio.seeking already false.
    const handleSeeking = () => {
      seekPending = true;
      clearTimeout(endTimer);
    };

    const handleSeeked = () => {
      seekPending = false;
      const range = currentPlaybackRange();
      if (isPlayingSelection() && range && isOutsideRange(audio.currentTime, range)) {
        stopSelectionPlayback({ pause: false });
        return;
      }
      scheduleEnd();
    };

    const followSelection = () => {
      if (!isPlayingSelection()) return;
      if (currentSelectionBounds()) scheduleEnd();
      else stopSelectionPlayback({ pause: true });
    };
    const unsubscribeSelection = useTimelineStore.subscribe((state, previous) => {
      if (state.selectedWords !== previous.selectedWords) followSelection();
    });
    const unsubscribeLines = useProjectStore.subscribe((state, previous) => {
      if (state.lines !== previous.lines) followSelection();
    });

    if (!audio.paused) handlePlay();
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("seeking", handleSeeking);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("ratechange", scheduleEnd);
    audio.addEventListener("timeupdate", checkEnd);
    return () => {
      clearTimeout(endTimer);
      unsubscribeSelection();
      unsubscribeLines();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("seeking", handleSeeking);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("ratechange", scheduleEnd);
      audio.removeEventListener("timeupdate", checkEnd);
      if (isPlayingSelection()) stopSelectionPlayback({ pause: false });
    };
  }, [active, audio]);
}

// -- Exports ------------------------------------------------------------------

export { useRangePlayback };
