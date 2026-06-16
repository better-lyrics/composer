import { commitHistory } from "@/stores/project/history-helpers";
import { normalizeSnapPoints } from "@/stores/project/snap-points-helpers";
import type { ProjectStore, SnapPointActions, SnapPointsState } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createSnapPointsInitialState(): SnapPointsState {
  return { customSnapPoints: [] };
}

// -- Slice --------------------------------------------------------------------

const createSnapPointsSlice: StateCreator<ProjectStore, [], [], SnapPointsState & SnapPointActions> = (set) => ({
  ...createSnapPointsInitialState(),

  setCustomSnapPoints: (points) => set({ customSnapPoints: normalizeSnapPoints(points) }),
  addCustomSnapPoint: (time) =>
    set((state) => commitHistory(state, { customSnapPoints: normalizeSnapPoints([...state.customSnapPoints, time]) })),
  removeCustomSnapPoint: (index) =>
    set((state) => {
      if (index < 0 || index >= state.customSnapPoints.length) return state;
      return commitHistory(state, { customSnapPoints: state.customSnapPoints.filter((_, i) => i !== index) });
    }),
  moveCustomSnapPoint: () => {},
  commitSnapPointDrag: () => {},
  clearCustomSnapPoints: () => set({ customSnapPoints: [] }),
});

// -- Exports ------------------------------------------------------------------

export { createSnapPointsSlice, createSnapPointsInitialState };
