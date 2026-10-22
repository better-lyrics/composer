import type { DismissalActions, DismissalsState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createDismissalsInitialState(): DismissalsState {
  return {
    dismissedSuggestions: [],
    dismissedExplicitSuggestions: [],
    dismissedMetadataMatches: [],
  };
}

// -- Slice --------------------------------------------------------------------

const createDismissalsSlice: StateCreator<ProjectStore, [], [], DismissalsState & DismissalActions> = (set) => ({
  ...createDismissalsInitialState(),

  dismissSuggestion: (fingerprint) =>
    set((state) => {
      if (state.dismissedSuggestions.includes(fingerprint)) return state;
      return { dismissedSuggestions: [...state.dismissedSuggestions, fingerprint], isDirty: true };
    }),

  setDismissedSuggestions: (fingerprints) => set({ dismissedSuggestions: fingerprints }),

  clearDismissedSuggestions: () => set({ dismissedSuggestions: [], isDirty: true }),

  restoreSuggestions: (fingerprints) =>
    set((state) => {
      const restored = new Set(fingerprints);
      return {
        dismissedSuggestions: state.dismissedSuggestions.filter((fingerprint) => !restored.has(fingerprint)),
        isDirty: true,
      };
    }),

  dismissExplicitSuggestion: (fingerprint) =>
    set((state) => {
      if (state.dismissedExplicitSuggestions.includes(fingerprint)) return state;
      return {
        dismissedExplicitSuggestions: [...state.dismissedExplicitSuggestions, fingerprint],
        isDirty: true,
      };
    }),

  setDismissedExplicitSuggestions: (fingerprints) => set({ dismissedExplicitSuggestions: fingerprints }),

  clearDismissedExplicitSuggestions: () => set({ dismissedExplicitSuggestions: [], isDirty: true }),

  restoreExplicitSuggestions: (fingerprints) =>
    set((state) => {
      const restored = new Set(fingerprints);
      return {
        dismissedExplicitSuggestions: state.dismissedExplicitSuggestions.filter(
          (fingerprint) => !restored.has(fingerprint),
        ),
        isDirty: true,
      };
    }),

  dismissMetadataMatch: (recordingId) =>
    set((state) => {
      if (state.dismissedMetadataMatches.includes(recordingId)) return state;
      return { dismissedMetadataMatches: [...state.dismissedMetadataMatches, recordingId], isDirty: true };
    }),

  setDismissedMetadataMatches: (recordingIds) => set({ dismissedMetadataMatches: recordingIds }),
});

// -- Exports ------------------------------------------------------------------

export { createDismissalsSlice, createDismissalsInitialState };
