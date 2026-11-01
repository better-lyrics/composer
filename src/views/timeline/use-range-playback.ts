import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useEffectiveFocus } from "@/views/timeline/effective-focus";
import {
  adoptLoopRegionForPlay,
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

// Keeps playback inside the active range (a played selection or region, else the open group) on every tab: its end stops or loops.
function useRangePlayback(): void {
  const groupOpen = useEffectiveFocus() !== null;
  const selectionPlayback = useTimelineStore((s) => s.selectionPlayback !== null);
  const regionSet = useTimelineStore((s) => s.loopRegion !== null);
  const audio = useAudioStore((s) => s.audioElement);
  const active = groupOpen || selectionPlayback || regionSet;

  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- endTimer is set from nested handlers and cleared in the returned cleanup
  useEffect(() => {
    if (!active || !audio) return;
    let endTimer: ReturnType<typeof setTimeout> | undefined;
    let seekPending = false;
    let ownSeeksAhead = 0;
    let lastSeekWasOwn = false;

    // A lag spike can land seeked after playback has already left a short range, so a seek of our own never reads as seeking away.
    const seekInsideRange = (time: number) => {
      ownSeeksAhead++;
      useAudioStore.getState().seekTo(time);
    };

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
      seekInsideRange(step.seekTo);
    };

    const handlePlay = () => {
      adoptLoopRegionForPlay();
      const range = currentPlaybackRange();
      const start = range ? soloPlayStart(audio.currentTime, range) : null;
      if (start !== null) seekInsideRange(start);
      scheduleEnd();
    };

    // Chrome fires a timeupdate at the seek target before seeked, with audio.seeking already false.
    const handleSeeking = () => {
      seekPending = true;
      lastSeekWasOwn = ownSeeksAhead > 0;
      if (lastSeekWasOwn) ownSeeksAhead--;
      clearTimeout(endTimer);
    };

    const handleSeeked = () => {
      seekPending = false;
      ownSeeksAhead = 0;
      const range = currentPlaybackRange();
      if (!lastSeekWasOwn && isPlayingSelection() && range && isOutsideRange(audio.currentTime, range)) {
        stopSelectionPlayback({ pause: false });
        return;
      }
      scheduleEnd();
    };

    // A range clamped to the song end can reach it before the end timer: the element pauses itself with `ended`.
    const handleEnded = () => {
      const range = currentPlaybackRange();
      if (!range) return;
      const store = useAudioStore.getState();
      seekInsideRange(range.begin);
      if (currentlyLoops()) store.setIsPlaying(true);
      else if (isPlayingSelection()) stopSelectionPlayback({ pause: true });
    };

    const followSelection = () => {
      if (!isPlayingSelection()) return;
      if (useTimelineStore.getState().loopRegion || currentSelectionBounds()) scheduleEnd();
      else stopSelectionPlayback({ pause: true });
    };
    const unsubscribeSelection = useTimelineStore.subscribe((state, previous) => {
      if (state.selectedWords !== previous.selectedWords || state.loopRegion !== previous.loopRegion) followSelection();
    });
    const unsubscribeLines = useProjectStore.subscribe((state, previous) => {
      if (state.lines !== previous.lines) followSelection();
    });

    if (!audio.paused) handlePlay();
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("seeking", handleSeeking);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("ratechange", scheduleEnd);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", checkEnd);
    return () => {
      clearTimeout(endTimer);
      unsubscribeSelection();
      unsubscribeLines();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("seeking", handleSeeking);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("ratechange", scheduleEnd);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", checkEnd);
      if (isPlayingSelection()) stopSelectionPlayback({ pause: false });
    };
  }, [active, audio]);
}

// -- Exports ------------------------------------------------------------------

export { useRangePlayback };
