import type { SavedAudioSource } from "@/domain/project/audio-source";
import { useSettingsStore } from "@/stores/settings";
import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type AudioSource = { type: "file"; file: File } | { type: "youtube"; videoId: string; file?: File } | null;
type YouTubeLoadFailure = "bridge-unreachable" | "fetch-failed";

interface AudioState {
  source: AudioSource;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  otherPlaybackRate: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  audioElement: HTMLAudioElement | null;
  youtubeLoadError: string | null;
  youtubeLoadFailure: YouTubeLoadFailure | null;
  youtubeFallbackSource: AudioSource;
  youtubeFallbackExpectedAudio: SavedAudioSource | null;
  expectedAudio: SavedAudioSource | null;
}

interface AudioActions {
  setSource: (source: AudioSource) => void;
  setYouTubeSource: (videoId: string, file?: File) => void;
  setYouTubeFile: (file: File) => void;
  expectProjectAudio: (saved: SavedAudioSource) => void;
  failYouTubeLoad: (error: string, failure?: YouTubeLoadFailure) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  restorePlaybackRates: (rates: { playbackRate: number; otherPlaybackRate: number }) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setIsLoading: (isLoading: boolean) => void;
  setYouTubeLoadError: (error: string | null) => void;
  registerAudioElement: (element: HTMLAudioElement | null) => void;
  seekTo: (time: number) => void;
  reset: () => void;
}

// -- Constants ----------------------------------------------------------------

const NORMAL_PLAYBACK_RATE = 1;
const FULL_VOLUME = 1;
const FIRST_OTHER_PLAYBACK_RATE = 0.75;

function createInitialState(): AudioState {
  const settings = useSettingsStore.getState();
  const startRate = settings.rememberPlaybackRate ? settings.lastPlaybackRate : settings.defaultPlaybackRate;
  return {
    source: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: startRate,
    otherPlaybackRate: startRate === NORMAL_PLAYBACK_RATE ? FIRST_OTHER_PLAYBACK_RATE : startRate,
    volume: settings.rememberVolume ? settings.lastVolume : FULL_VOLUME,
    isMuted: false,
    isLoading: false,
    audioElement: null,
    youtubeLoadError: null,
    youtubeLoadFailure: null,
    youtubeFallbackSource: null,
    youtubeFallbackExpectedAudio: null,
    expectedAudio: null,
  };
}

const INITIAL_STATE: AudioState = createInitialState();

// -- Helpers ------------------------------------------------------------------

function fallbackBeforeYouTubeLoad(state: AudioState): AudioSource {
  const { source } = state;
  return source?.type === "youtube" && !source.file ? state.youtubeFallbackSource : source;
}

function fallbackExpectedAudioBeforeYouTubeLoad(state: AudioState): SavedAudioSource | null {
  return state.expectedAudio ?? state.youtubeFallbackExpectedAudio;
}

// -- Store --------------------------------------------------------------------

const useAudioStore = create<AudioState & AudioActions>((set, get) => ({
  ...INITIAL_STATE,

  setSource: (source) =>
    set({
      source,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      youtubeLoadError: null,
      youtubeLoadFailure: null,
      youtubeFallbackSource: null,
      youtubeFallbackExpectedAudio: null,
      expectedAudio: null,
    }),
  setYouTubeSource: (videoId, file) =>
    set((s) => ({
      source: { type: "youtube", videoId, file },
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      youtubeLoadError: null,
      youtubeLoadFailure: null,
      youtubeFallbackSource: file ? null : fallbackBeforeYouTubeLoad(s),
      youtubeFallbackExpectedAudio: file ? null : fallbackExpectedAudioBeforeYouTubeLoad(s),
      expectedAudio: null,
    })),
  setYouTubeFile: (file) =>
    set((s) => {
      if (!s.source || s.source.type !== "youtube") return {};
      return {
        source: { ...s.source, file },
        youtubeFallbackSource: null,
        youtubeFallbackExpectedAudio: null,
        youtubeLoadFailure: null,
        expectedAudio: null,
      };
    }),
  expectProjectAudio: (saved) =>
    set({
      source: saved.kind === "youtube" ? { type: "youtube", videoId: saved.videoId } : null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      youtubeLoadError: null,
      youtubeLoadFailure: null,
      youtubeFallbackSource: null,
      youtubeFallbackExpectedAudio: null,
      expectedAudio: saved,
    }),
  failYouTubeLoad: (error, failure = "fetch-failed") =>
    set((s) => ({
      source: s.youtubeFallbackSource,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      youtubeLoadError: error,
      youtubeLoadFailure: failure,
      youtubeFallbackSource: null,
      youtubeFallbackExpectedAudio: null,
      expectedAudio: fallbackExpectedAudioBeforeYouTubeLoad(s),
    })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (playbackRate) => {
    if (!Number.isFinite(playbackRate) || playbackRate <= 0) return;
    const settings = useSettingsStore.getState();
    if (settings.rememberPlaybackRate) settings.set("lastPlaybackRate", playbackRate);
    set(playbackRate === NORMAL_PLAYBACK_RATE ? { playbackRate } : { playbackRate, otherPlaybackRate: playbackRate });
  },
  restorePlaybackRates: ({ playbackRate, otherPlaybackRate }) => {
    useAudioStore.getState().setPlaybackRate(playbackRate);
    set({ otherPlaybackRate });
  },
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setIsLoading: (isLoading) => set({ isLoading }),
  setYouTubeLoadError: (youtubeLoadError) => set({ youtubeLoadError }),
  registerAudioElement: (audioElement) => set({ audioElement }),
  seekTo: (time: number) => {
    if (!Number.isFinite(time) || time < 0) return;
    const audio = get().audioElement;
    if (audio) {
      audio.currentTime = time;
    }
    set({ currentTime: time });
  },
  reset: () => set(createInitialState()),
}));

// -- Readers ------------------------------------------------------------------

function toggledPlaybackRate(): number {
  const { playbackRate, otherPlaybackRate } = useAudioStore.getState();
  return playbackRate === NORMAL_PLAYBACK_RATE ? otherPlaybackRate : NORMAL_PLAYBACK_RATE;
}

function livePlaybackTime(): number {
  const { audioElement, currentTime } = useAudioStore.getState();
  return audioElement?.currentTime ?? currentTime;
}

function seekBy(seconds: number): void {
  const { duration, seekTo } = useAudioStore.getState();
  const target = Math.max(0, livePlaybackTime() + seconds);
  seekTo(duration > 0 ? Math.min(duration, target) : target);
}

// -- Exports ------------------------------------------------------------------

export { FULL_VOLUME, NORMAL_PLAYBACK_RATE, livePlaybackTime, seekBy, toggledPlaybackRate, useAudioStore };
export type { AudioSource };
