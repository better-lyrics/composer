import { moveWordsFromBackground, moveWordsToBackground } from "@/domain/commands/background-moves";
import { markTransientLines } from "@/stores/project/transient-lines";
import type { LineActions, LinesState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Initial State ------------------------------------------------------------

function createLinesInitialState(): LinesState {
  return {
    lines: [],
  };
}

// -- Slice --------------------------------------------------------------------

const createLinesSlice: StateCreator<ProjectStore, [], [], LinesState & LineActions> = (set, get) => ({
  ...createLinesInitialState(),

  restoreLyrics: (root) =>
    set({
      ...(root.lines && { lines: root.lines }),
      ...("groups" in root && { groups: Array.isArray(root.groups) ? root.groups : [] }),
      ...(root.agents && { agents: root.agents }),
      isDirty: true,
      isDirtySinceHistory: true,
    }),

  // A drag preview: no history, no dirty flags. The caller keeps the pre-gesture lines, checks by identity that no
  // other writer replaced its preview, and ends the gesture with restorePreviewLines or a command.
  previewLines: (lines) => {
    markTransientLines(lines);
    set({ lines });
  },

  restorePreviewLines: (lines) => set({ lines }),

  moveWordToBg: (lineId, wordIndices, timeDelta, duration) => {
    get().commit(moveWordsToBackground({ lineId, wordIndices, timeDelta, duration }));
  },

  moveWordFromBg: (lineId, wordIndices, timeDelta, duration) => {
    get().commit(moveWordsFromBackground({ lineId, wordIndices, timeDelta, duration }));
  },
});

// -- Exports ------------------------------------------------------------------

export { createLinesInitialState, createLinesSlice };
