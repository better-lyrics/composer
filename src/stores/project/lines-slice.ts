import { docFromFlatLines } from "insync/group-doc-from-flat-lines";
import { writingLyrics } from "@/stores/project/lyric-change-listeners";
import { markTransientLines } from "@/stores/project/transient-lines";
import type { LineActions, LinesState, ProjectStore } from "@/stores/project/types";
import { emptyBody, withBody } from "@/stores/project/with-body";
import type { StateCreator } from "zustand";
import { getSplitCharacter } from "@/utils/split-character";

// -- Initial State ------------------------------------------------------------

function createLinesInitialState(): LinesState {
  return {
    ...emptyBody(),
    parts: [],
    passthrough: {},
  };
}

// -- Slice --------------------------------------------------------------------

const createLinesSlice: StateCreator<ProjectStore, [], [], LinesState & LineActions> = (set, get) => ({
  ...createLinesInitialState(),

  restoreLyrics: (root) =>
    writingLyrics(get, "restore", () =>
      set({
        ...(root.lines && withBody(docFromFlatLines(root.lines, getSplitCharacter()))),
        ...("groups" in root && { groups: Array.isArray(root.groups) ? root.groups : [] }),
        ...(root.agents && { agents: root.agents }),
        ...(root.parts && { parts: root.parts }),
        ...(root.passthrough && { passthrough: root.passthrough }),
        isDirty: true,
        isDirtySinceHistory: true,
      }),
    ),

  // A drag preview: no history, no dirty flags. The caller keeps the pre-gesture lines, checks by identity that no
  // other writer replaced its preview, and ends the gesture with restorePreviewLines or a command.
  previewLines: (lines) => {
    markTransientLines(lines);
    writingLyrics(get, "preview", () => set({ lines }));
  },

  restorePreviewLines: (lines) => writingLyrics(get, "preview", () => set({ lines })),
});

// -- Exports ------------------------------------------------------------------

export { createLinesInitialState, createLinesSlice };
