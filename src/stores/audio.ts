import { create } from "zustand";

// -- Types --------------------------------------------------------------------

type AudioSource = { type: "file"; file: File } | { type: "youtube"; videoId: string } | null;

interface AudioState {
  source: AudioSource;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isLoading: boolean;
  audioElement: HTMLAudioElement | null;
  waveformData: number[] | null;
}

interface AudioActions {
  setSource: (source: AudioSource) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  setIsLoading: (isLoading: boolean) => void;
  registerAudioElement: (element: HTMLAudioElement | null) => void;
  setWaveformData: (data: number[] | null) => void;
  seekTo: (time: number) => void;
  reset: () => void;
}

// -- Constants ----------------------------------------------------------------

const INITIAL_STATE: AudioState = {
  source: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 0.75,
  isLoading: false,
  audioElement: null,
  waveformData: null,
};

// -- Store --------------------------------------------------------------------

const useAudioStore = create<AudioState & AudioActions>((set, get) => ({
  ...INITIAL_STATE,

  setSource: (source) => set({ source, currentTime: 0, duration: 0, isPlaying: false }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setIsLoading: (isLoading) => set({ isLoading }),
  registerAudioElement: (audioElement) => set({ audioElement }),
  setWaveformData: (waveformData) => set({ waveformData }),
  seekTo: (time: number) => {
    const audio = get().audioElement;
    if (audio) {
      audio.currentTime = time;
    }
    set({ currentTime: time });
  },
  reset: () => set(INITIAL_STATE),
}));

export { useAudioStore, INITIAL_STATE };
export type { AudioSource, AudioState };
