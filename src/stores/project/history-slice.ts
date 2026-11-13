import { notifySharedTimingCopied } from "@/lib/shared-timing-signals";
import { commitCommand } from "@/stores/project/commit";
import { canUndoFrom, commitPendingEdit, redoState, undoState } from "@/stores/project/history-helpers";
import type { HistoryActions, HistoryState } from "@/stores/project/history-types";
import type { ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createHistoryInitialState(): HistoryState {
  return {
    isDirty: false,
    history: [],
    historyIndex: -1,
    isDirtySinceHistory: false,
    pendingNote: null,
  };
}

// -- Slice --------------------------------------------------------------------

const createHistorySlice: StateCreator<ProjectStore, [], [], HistoryState & HistoryActions> = (set, get) => ({
  ...createHistoryInitialState(),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  commit: (command, mode = "step") => {
    const { patch, outcome, copiedGroupIds } = commitCommand(get(), command, mode);
    if (patch) set(patch);
    if (copiedGroupIds.length) notifySharedTimingCopied(copiedGroupIds);
    return outcome;
  },

  undo: () => set(undoState),

  redo: () => set(redoState),

  beginLyricBurst: () => ({ lines: get().lines, wasPending: get().isDirtySinceHistory }),

  closeLyricBurst: (burst) => set((state) => commitPendingEdit(state, burst.lines, burst.wasPending)),

  isCurrentStep: (entry) => {
    const { history, historyIndex, isDirtySinceHistory } = get();
    return history[historyIndex] === entry && !isDirtySinceHistory;
  },

  canUndo: () => canUndoFrom(get()),

  canRedo: () => get().historyIndex < get().history.length - 1,

  clearHistory: () => set({ history: [], historyIndex: -1, isDirtySinceHistory: false, pendingNote: null }),
});

// -- Exports ------------------------------------------------------------------

export { createHistorySlice, createHistoryInitialState };
