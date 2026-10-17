import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { SYNC_COUNT_IN_IDLE, useSyncCountInStore } from "@/stores/sync-count-in";

// -- Types --------------------------------------------------------------------

type PlaybackRequest = "counting" | "playing";

// -- Constants ----------------------------------------------------------------

// A seek to the very start can land a millisecond in, so the start is a small window, not exactly zero.
const SONG_START_WINDOW_SECONDS = 0.05;

// -- State --------------------------------------------------------------------

let startTimer: ReturnType<typeof setTimeout> | null = null;
let stopWatchingSource: (() => void) | null = null;

// -- Helpers ------------------------------------------------------------------

function isCountingIn(): boolean {
  return startTimer !== null;
}

function endCount(): void {
  if (startTimer !== null) clearTimeout(startTimer);
  startTimer = null;
  stopWatchingSource?.();
  stopWatchingSource = null;
  useSyncCountInStore.setState(SYNC_COUNT_IN_IDLE);
}

function countsIn(): boolean {
  return (
    useProjectStore.getState().activeTab === "sync" &&
    useAudioStore.getState().source !== null &&
    livePlaybackTime() < SONG_START_WINDOW_SECONDS &&
    useSettingsStore.getState().syncCountIn > 0
  );
}

// -- Actions ------------------------------------------------------------------

function requestPlayback(): PlaybackRequest {
  if (isCountingIn()) return "counting";
  if (useAudioStore.getState().isPlaying) return "playing";
  if (!countsIn()) {
    useAudioStore.getState().setIsPlaying(true);
    return "playing";
  }
  const seconds = useSettingsStore.getState().syncCountIn;
  const startedAt = performance.now();
  startTimer = setTimeout(() => {
    endCount();
    useAudioStore.getState().setIsPlaying(true);
  }, seconds * 1000);
  stopWatchingSource = useAudioStore.subscribe((state, previous) => {
    if (state.source !== previous.source) cancelCountIn();
  });
  useSyncCountInStore.setState({ startedAt, endsAt: startedAt + seconds * 1000, seconds });
  return "counting";
}

function cancelCountIn(): void {
  if (isCountingIn()) endCount();
}

function skipCountIn(): void {
  if (!isCountingIn()) return;
  endCount();
  useAudioStore.getState().setIsPlaying(true);
}

function togglePlayback(): void {
  if (isCountingIn()) {
    cancelCountIn();
    return;
  }
  const { isPlaying, setIsPlaying } = useAudioStore.getState();
  if (isPlaying) {
    setIsPlaying(false);
    return;
  }
  requestPlayback();
}

// -- Exports ------------------------------------------------------------------

export { cancelCountIn, isCountingIn, requestPlayback, skipCountIn, togglePlayback };
export type { PlaybackRequest };
