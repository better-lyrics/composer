import { useAudioStore } from "@/stores/audio";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Interfaces ----------------------------------------------------------------

interface PlaybackSample {
  currentTime: number;
  paused: boolean;
  playbackRate: number;
}

// The clock a lyrics renderer follows and the transport it drives.
interface RendererPlayback {
  sample: () => PlaybackSample | null;
  seekTo: (seconds: number) => void;
  play: () => void;
}

// -- Functions -----------------------------------------------------------------

// A playhead drag only seeks on release, so renderers follow the dragged time meanwhile.
function audioStoreSample(): PlaybackSample | null {
  const audio = useAudioStore.getState().audioElement;
  if (!audio) return null;
  const { isDraggingPlayhead, dragTime } = useTimelineStore.getState();
  if (!isDraggingPlayhead) return audio;
  return { currentTime: dragTime, paused: audio.paused, playbackRate: audio.playbackRate };
}

// -- Constants -----------------------------------------------------------------

const AUDIO_STORE_PLAYBACK: RendererPlayback = {
  // Read each frame so the renderer keeps tracking the element the audio engine recreates.
  sample: audioStoreSample,
  seekTo: (seconds) => useAudioStore.getState().seekTo(seconds),
  play: () => useAudioStore.getState().setIsPlaying(true),
};

// -- Exports -------------------------------------------------------------------

export { AUDIO_STORE_PLAYBACK };
export type { PlaybackSample, RendererPlayback };
