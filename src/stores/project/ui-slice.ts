import { useAudioStore } from "@/stores/audio";
import type { ProjectStore, UiActions, UiState } from "@/stores/project/types";
import { useSettingsStore } from "@/stores/settings";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createUiInitialState(): UiState {
  return {
    granularity: useSettingsStore.getState().defaultGranularity,
    editorMode: "simple",
    activeTab: "import",
  };
}

// -- Slice --------------------------------------------------------------------

const createUiSlice: StateCreator<ProjectStore, [], [], UiState & UiActions> = (set) => ({
  ...createUiInitialState(),

  setGranularity: (granularity) => set({ granularity, isDirty: true }),

  setEditorMode: (editorMode) => set({ editorMode }),

  setActiveTab: (activeTab) => {
    if (activeTab === "export") {
      useAudioStore.getState().setIsPlaying(false);
    }
    set({ activeTab });
  },
});

// -- Exports ------------------------------------------------------------------

export { createUiSlice, createUiInitialState };
