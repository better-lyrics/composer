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
  addCustomSnapPoint: () => {},
  removeCustomSnapPoint: () => {},
  moveCustomSnapPoint: () => {},
  commitSnapPointDrag: () => {},
  clearCustomSnapPoints: () => set({ customSnapPoints: [] }),
});

// -- Exports ------------------------------------------------------------------

export { createSnapPointsSlice, createSnapPointsInitialState };
