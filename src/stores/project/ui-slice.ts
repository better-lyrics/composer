import { DEFAULT_SYLLABLE_SPLIT_DEFAULTS } from "@/domain/project/syllable-split-defaults";
import { useAudioStore } from "@/stores/audio";
import type { ProjectStore, UiActions, UiState } from "@/stores/project/types";
import { useSettingsStore } from "@/stores/settings";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createUiInitialState(): UiState {
  return {
    granularity: useSettingsStore.getState().defaultGranularity,
    exportTiming: "word",
    editorMode: "simple",
    activeTab: "import",
    syllableSplitDefaults: DEFAULT_SYLLABLE_SPLIT_DEFAULTS,
    primingStripped: false,
  };
}

// -- Slice --------------------------------------------------------------------

const createUiSlice: StateCreator<ProjectStore, [], [], UiState & UiActions> = (set) => ({
  ...createUiInitialState(),

  setGranularity: (granularity) => set({ granularity, isDirty: true }),

  setExportTiming: (exportTiming) => set({ exportTiming, isDirty: true }),

  setEditorMode: (editorMode) => set({ editorMode }),

  setActiveTab: (activeTab) => {
    if (activeTab === "export") {
      useAudioStore.getState().setIsPlaying(false);
    }
    set({ activeTab });
  },

  setSyllableSplitDefaults: (syllableSplitDefaults) => set({ syllableSplitDefaults, isDirty: true }),

  setPrimingStripped: (primingStripped) =>
    set((state) => (state.primingStripped === primingStripped ? state : { primingStripped, isDirty: true })),
});

// -- Exports ------------------------------------------------------------------

export { createUiSlice, createUiInitialState };
