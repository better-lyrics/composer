import { commitBeatGridOffset, commitHistory } from "@/stores/project/history-helpers";
import type { BeatGridActions, BeatGridState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createBeatGridInitialState(): BeatGridState {
  return { beatGrid: null };
}

// -- Slice --------------------------------------------------------------------

const createBeatGridSlice: StateCreator<ProjectStore, [], [], BeatGridState & BeatGridActions> = (set) => ({
  ...createBeatGridInitialState(),

  setBeatGrid: (grid) => set({ beatGrid: grid, isDirtySinceHistory: true }),
  applyBeatGridWithHistory: (grid) => set((state) => commitHistory(state, { beatGrid: grid })),
  nudgeBeatGridOffsetWithHistory: (grid) => set((state) => commitBeatGridOffset(state, grid)),
  clearBeatGrid: () =>
    set((state) => (state.beatGrid === null ? state : { beatGrid: null, isDirty: true, isDirtySinceHistory: true })),
});

// -- Exports ------------------------------------------------------------------

export { createBeatGridInitialState, createBeatGridSlice };
