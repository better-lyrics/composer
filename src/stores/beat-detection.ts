import { detectBeats } from "@/audio/beat/detect-beats";
import { detectedGrid } from "@/domain/tempo/beat-grid";
import { playableFile, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { create } from "zustand";

// -- Types ---------------------------------------------------------------------

type BeatDetectionStatus = "idle" | "downloading" | "detecting" | "error";

interface BeatDetectionProgress {
  status: BeatDetectionStatus;
  loaded: number;
  total: number;
  done: number;
  chunks: number;
  error: string | null;
}

interface BeatDetectionState extends BeatDetectionProgress {
  run: () => Promise<void>;
  cancel: () => void;
  dismiss: () => void;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[BeatDetection]";
const IDLE: BeatDetectionProgress = { status: "idle", loaded: 0, total: 0, done: 0, chunks: 0, error: null };

// -- Store ---------------------------------------------------------------------

let running: AbortController | null = null;

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const useBeatDetectionStore = create<BeatDetectionState>((set) => ({
  ...IDLE,

  run: async () => {
    const source = useAudioStore.getState().source;
    const file = playableFile(source);
    if (!file) return;
    running?.abort();
    const controller = new AbortController();
    running = controller;
    const isCurrent = () => running === controller && useAudioStore.getState().source === source;
    set({ ...IDLE, status: "downloading" });
    try {
      const detection = await detectBeats({
        source: file,
        signal: controller.signal,
        onDownloadProgress: (loaded, total) => {
          if (isCurrent()) set({ status: "downloading", loaded, total });
        },
        onDetectProgress: (done, chunks) => {
          if (isCurrent()) set({ status: "detecting", done, chunks });
        },
      });
      if (!isCurrent()) return;
      useProjectStore.getState().applyBeatGridWithHistory(detectedGrid(detection));
      set(IDLE);
    } catch (error) {
      if (!isCurrent() || isAbort(error)) return;
      console.warn(LOG_PREFIX, "detection failed", error);
      set({ ...IDLE, status: "error", error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (running === controller) running = null;
    }
  },

  cancel: () => {
    running?.abort();
    running = null;
    set(IDLE);
  },

  dismiss: () => set(IDLE),
}));

useAudioStore.subscribe((state, prev) => {
  if (state.source !== prev.source) useBeatDetectionStore.getState().cancel();
});

// -- Exports -------------------------------------------------------------------

export { useBeatDetectionStore };
export type { BeatDetectionStatus };
