import { useAudioStore } from "@/stores/audio";

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

// -- Constants -----------------------------------------------------------------

const AUDIO_STORE_PLAYBACK: RendererPlayback = {
  // Read each frame so the renderer keeps tracking the element the audio engine recreates.
  sample: () => useAudioStore.getState().audioElement,
  seekTo: (seconds) => useAudioStore.getState().seekTo(seconds),
  play: () => useAudioStore.getState().setIsPlaying(true),
};

// -- Exports -------------------------------------------------------------------

export { AUDIO_STORE_PLAYBACK };
export type { PlaybackSample, RendererPlayback };
