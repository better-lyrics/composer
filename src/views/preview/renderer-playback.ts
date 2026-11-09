import { isFollowingAudioLine } from "@/audio/playback-clock";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useAudioStore } from "@/stores/audio";
import { playheadTime } from "@/views/timeline/playhead-time";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Interfaces ----------------------------------------------------------------

interface PlaybackSample {
  currentTime: number;
  paused: boolean;
  // False while the time still crawls after a play, so a renderer sets its sweep from it instead of running ahead.
  followsAudio: boolean;
  playbackRate: number;
}

// The clock a lyrics renderer follows and the transport it drives.
interface RendererPlayback {
  sample: () => PlaybackSample | null;
  seekTo: (seconds: number) => void;
  play: () => void;
}

// -- Functions -----------------------------------------------------------------

const liveSample: PlaybackSample = { currentTime: 0, paused: true, followsAudio: false, playbackRate: 1 };

// A playhead drag only seeks on release, so renderers follow the dragged time meanwhile.
function audioStoreSample(): PlaybackSample | null {
  const audio = useAudioStore.getState().audioElement;
  if (!audio) return null;
  liveSample.currentTime = playheadTime();
  liveSample.paused = audio.paused;
  liveSample.followsAudio = !useTimelineStore.getState().isDraggingPlayhead && isFollowingAudioLine();
  liveSample.playbackRate = audio.playbackRate;
  return liveSample;
}

// -- Constants -----------------------------------------------------------------

const AUDIO_STORE_PLAYBACK: RendererPlayback = {
  // Read each frame so the renderer keeps tracking the element the audio engine recreates.
  sample: audioStoreSample,
  seekTo: (seconds) => {
    useAudioStore.getState().seekTo(seconds);
    noteGuideSignal("preview.seek");
  },
  play: () => useAudioStore.getState().setIsPlaying(true),
};

// -- Exports -------------------------------------------------------------------

export type { PlaybackSample, RendererPlayback };
export { AUDIO_STORE_PLAYBACK };
