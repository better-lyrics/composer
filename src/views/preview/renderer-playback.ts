import { isFollowingAudioLine } from "@/audio/playback-clock";
import { frameTime } from "@/lib/frame-loop";
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
  // A playhead drag: renderers draw each time as a still frame, so nothing animates between times.
  scrubbing?: boolean;
}

// The clock a lyrics renderer follows and the transport it drives.
interface RendererPlayback {
  sample: () => PlaybackSample | null;
  seekTo: (seconds: number) => void;
  play: () => void;
}

// -- Functions -----------------------------------------------------------------

const liveSample: PlaybackSample = {
  currentTime: 0,
  paused: true,
  followsAudio: false,
  playbackRate: 1,
  scrubbing: false,
};
let shownDrag: { time: number; at: number } | null = null;

// Each dragged time restyles the lyrics in the preview process, which competes with the drag on slow machines.
function shownPlayheadTime(isDraggingPlayhead: boolean): number {
  if (!isDraggingPlayhead) {
    shownDrag = null;
    return playheadTime();
  }
  const now = frameTime();
  if (!shownDrag || now - shownDrag.at >= DRAG_PREVIEW_INTERVAL_MS) shownDrag = { time: playheadTime(), at: now };
  return shownDrag.time;
}

// A playhead drag only seeks on release, so renderers follow the dragged time meanwhile.
function audioStoreSample(): PlaybackSample | null {
  const audio = useAudioStore.getState().audioElement;
  if (!audio) return null;
  const { isDraggingPlayhead } = useTimelineStore.getState();
  liveSample.currentTime = shownPlayheadTime(isDraggingPlayhead);
  liveSample.paused = audio.paused;
  liveSample.followsAudio = !isDraggingPlayhead && isFollowingAudioLine();
  liveSample.playbackRate = audio.playbackRate;
  liveSample.scrubbing = isDraggingPlayhead;
  return liveSample;
}

// -- Constants -----------------------------------------------------------------

const DRAG_PREVIEW_INTERVAL_MS = 66;

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
