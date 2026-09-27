import { canUndoFrom, commitPendingEdit, redoState, undoState } from "@/stores/project/history-helpers";
import type { HistoryActions, HistoryState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createHistoryInitialState(): HistoryState {
  return {
    isDirty: false,
    history: [],
    historyIndex: -1,
    isDirtySinceHistory: false,
  };
}

// -- Slice --------------------------------------------------------------------

const createHistorySlice: StateCreator<ProjectStore, [], [], HistoryState & HistoryActions> = (set, get) => ({
  ...createHistoryInitialState(),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  undo: () => set(undoState),

  redo: () => set(redoState),

  commitPendingLineEdit: (baseline, baselineWasDirty) =>
    set((state) => commitPendingEdit(state, baseline, baselineWasDirty)),

  canUndo: () => canUndoFrom(get()),

  canRedo: () => get().historyIndex < get().history.length - 1,

  clearHistory: () => set({ history: [], historyIndex: -1, isDirtySinceHistory: false }),
});

// -- Exports ------------------------------------------------------------------

export { createHistorySlice, createHistoryInitialState };
