import { holdFrames } from "@/lib/frame-loop";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { SYNC_COUNT_IN_IDLE, useSyncCountInStore } from "@/stores/sync-count-in";

// -- Types --------------------------------------------------------------------

type PlaybackRequest = "counting" | "playing";

// -- Constants ----------------------------------------------------------------

const COUNT_IN_FRAME_LABEL = "sync count-in";

// -- State --------------------------------------------------------------------

let startTimer: ReturnType<typeof setTimeout> | null = null;
let releaseFrames: (() => void) | null = null;

// -- Helpers ------------------------------------------------------------------

function isCountingIn(): boolean {
  return startTimer !== null;
}

function endCount(): void {
  if (startTimer !== null) clearTimeout(startTimer);
  startTimer = null;
  releaseFrames?.();
  releaseFrames = null;
  useSyncCountInStore.setState(SYNC_COUNT_IN_IDLE);
}

function countsIn(): boolean {
  return (
    useProjectStore.getState().activeTab === "sync" &&
    useAudioStore.getState().source !== null &&
    useSettingsStore.getState().syncCountIn > 0
  );
}

// -- Actions ------------------------------------------------------------------

function requestPlayback(): PlaybackRequest {
  if (isCountingIn()) return "counting";
  if (!countsIn()) {
    useAudioStore.getState().setIsPlaying(true);
    return "playing";
  }
  const seconds = useSettingsStore.getState().syncCountIn;
  const startedAt = performance.now();
  releaseFrames = holdFrames(COUNT_IN_FRAME_LABEL);
  startTimer = setTimeout(() => {
    endCount();
    useAudioStore.getState().setIsPlaying(true);
  }, seconds * 1000);
  useSyncCountInStore.setState({ startedAt, endsAt: startedAt + seconds * 1000, seconds });
  return "counting";
}

function cancelCountIn(): void {
  if (isCountingIn()) endCount();
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

export { cancelCountIn, isCountingIn, requestPlayback, togglePlayback };
export type { PlaybackRequest };
