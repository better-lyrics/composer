import { createSnapPoint, normalizeSnapPoints } from "@/domain/snap-point/model";
import { commitHistory, commitSnapPointEdit } from "@/stores/project/history-helpers";
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
    set((state) =>
      commitHistory(state, {
        customSnapPoints: normalizeSnapPoints([...state.customSnapPoints, createSnapPoint(time)]),
      }),
    ),
  removeCustomSnapPoint: (id) =>
    set((state) => {
      if (!state.customSnapPoints.some((point) => point.id === id)) return state;
      return commitHistory(state, { customSnapPoints: state.customSnapPoints.filter((point) => point.id !== id) });
    }),
  moveCustomSnapPoint: (id, time) =>
    set((state) => {
      if (!state.customSnapPoints.some((point) => point.id === id)) return state;
      return {
        customSnapPoints: normalizeSnapPoints(
          state.customSnapPoints.map((point) => (point.id === id ? { ...point, time } : point)),
        ),
      };
    }),
  commitSnapPointDrag: (baseline) => set((state) => commitSnapPointEdit(state, normalizeSnapPoints(baseline))),
  clearCustomSnapPoints: () => set({ customSnapPoints: [] }),
});

// -- Exports ------------------------------------------------------------------

export { createSnapPointsSlice, createSnapPointsInitialState };
