import type { StateCreator } from "zustand";
import type { ProjectStore } from "@/stores/project/types";

// -- Types --------------------------------------------------------------------

interface UnisonLinkState {
  unisonLyricId: string | null;
}

interface UnisonLinkActions {
  linkUnisonLyric: (id: string) => void;
  unlinkUnisonLyric: () => void;
  restoreUnisonLink: (id: string | null) => void;
}

// -- Initial State ------------------------------------------------------------

function createUnisonLinkInitialState(): UnisonLinkState {
  return { unisonLyricId: null };
}

// -- Slice --------------------------------------------------------------------

const createUnisonLinkSlice: StateCreator<ProjectStore, [], [], UnisonLinkState & UnisonLinkActions> = (set) => ({
  ...createUnisonLinkInitialState(),

  linkUnisonLyric: (id) => set({ unisonLyricId: id, isDirty: true }),

  unlinkUnisonLyric: () => set({ unisonLyricId: null, isDirty: true }),

  restoreUnisonLink: (id) => set({ unisonLyricId: id }),
});

// -- Exports ------------------------------------------------------------------

export type { UnisonLinkActions, UnisonLinkState };
export { createUnisonLinkInitialState, createUnisonLinkSlice };
