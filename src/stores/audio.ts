import { useSettingsStore } from "@/stores/settings";
import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type AudioSource = { type: "file"; file: File } | { type: "youtube"; videoId: string } | null;

interface AudioState {
  source: AudioSource;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  audioElement: HTMLAudioElement | null;
}

interface AudioActions {
  setSource: (source: AudioSource) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setIsLoading: (isLoading: boolean) => void;
  registerAudioElement: (element: HTMLAudioElement | null) => void;
  seekTo: (time: number) => void;
  reset: () => void;
}

// -- Constants ----------------------------------------------------------------

function createInitialState(): AudioState {
  const settings = useSettingsStore.getState();
  return {
    source: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: settings.defaultPlaybackRate,
    volume: settings.rememberVolume ? settings.lastVolume : 1,
    isMuted: false,
    isLoading: false,
    audioElement: null,
  };
}

const INITIAL_STATE: AudioState = createInitialState();

// -- Store --------------------------------------------------------------------

const useAudioStore = create<AudioState & AudioActions>((set, get) => ({
  ...INITIAL_STATE,

  setSource: (source) => set({ source, currentTime: 0, duration: 0, isPlaying: false }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setIsLoading: (isLoading) => set({ isLoading }),
  registerAudioElement: (audioElement) => set({ audioElement }),
  seekTo: (time: number) => {
    const audio = get().audioElement;
    if (audio) {
      audio.currentTime = time;
    }
    set({ currentTime: time });
  },
  reset: () => set(createInitialState()),
}));

export { useAudioStore, INITIAL_STATE };
export type { AudioSource, AudioState };
