import { moveWordsFromBackground, moveWordsToBackground } from "@/domain/commands/background-moves";
import { editLines, insertEmptyLine, replaceLines } from "@/domain/commands/line-edits";
import {
  applyWordCountChange,
  markWordsExplicit,
  mergeSyllableGroup,
  snapSyllablesFlush,
  splitIdenticalSyllables,
  toggleWordExplicit,
} from "@/domain/commands/word-edits";
import { markTransientLines } from "@/stores/project/transient-lines";
import type { LineActions, LinesState, ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Helpers ------------------------------------------------------------------

function editOptions(options: { deriveText?: boolean; propagateToSiblings?: boolean }) {
  return { derivesText: options.deriveText ?? true, propagateToSiblings: options.propagateToSiblings ?? true };
}

// -- Initial State ------------------------------------------------------------

function createLinesInitialState(): LinesState {
  return {
    lines: [],
  };
}

// -- Slice --------------------------------------------------------------------

const createLinesSlice: StateCreator<ProjectStore, [], [], LinesState & LineActions> = (set, get) => ({
  ...createLinesInitialState(),

  setLines: (lines) => set({ lines, isDirty: true, isDirtySinceHistory: true }),

  // Transient in-flight gesture preview: replaces lines WITHOUT touching
  // history or dirty flags. The caller must hold the pre-gesture snapshot and
  // either restore it or commit through an action with history before the
  // gesture ends, and must verify (by array identity) that no other writer
  // replaced lines mid-gesture. Reserved for drag previews (e.g. the timeline
  // selection stretch) — never for durable edits.
  setTransientLines: (lines) => {
    markTransientLines(lines);
    set({ lines });
  },

  restoreTransientLines: (lines) => set({ lines }),

  setLinesWithHistory: (lines, groups) => {
    get().commit(replaceLines(lines, groups));
  },

  insertEmptyLineWithHistory: (anchorLineId, position) => {
    get().commit(insertEmptyLine({ anchorLineId, position }));
  },

  updateLine: (id, updates, options = {}) => {
    const command = editLines([{ id, updates }], {
      derivesText: options.deriveText ?? true,
      propagateToSiblings: false,
      copiesSharedTiming: false,
    });
    get().commit(command, "pending");
  },

  updateLineWithHistory: (id, updates, options = {}) => {
    get().commit(editLines([{ id, updates }], editOptions(options)));
  },

  updateLinesWithHistory: (updates, options = {}) => {
    get().commit(editLines(updates, editOptions(options)));
  },

  moveWordToBg: (lineId, wordIndices, timeDelta, duration) => {
    get().commit(moveWordsToBackground({ lineId, wordIndices, timeDelta, duration }));
  },

  moveWordFromBg: (lineId, wordIndices, timeDelta, duration) => {
    get().commit(moveWordsFromBackground({ lineId, wordIndices, timeDelta, duration }));
  },

  applyWordCountChange: (lineId, newWords, field, resolution, extraUpdates = {}) => {
    get().commit(applyWordCountChange(lineId, newWords, field, resolution, extraUpdates));
  },

  toggleWordExplicit: (lineId, field, wordIndices) => {
    get().commit(toggleWordExplicit(lineId, field, wordIndices));
  },

  mergeSyllableGroupIntoWord: (lineId, field, wordIndices) => {
    get().commit(mergeSyllableGroup(lineId, field, wordIndices));
  },

  snapSyllablesFlush: (lineId, field) => {
    get().commit(snapSyllablesFlush(lineId, field));
  },

  markWordsExplicit: (targets, value) => {
    get().commit(markWordsExplicit(targets, value));
  },

  splitSyllablesAcrossIdenticalWordsWithHistory: (params) => {
    get().commit(splitIdenticalSyllables(params));
  },
});

// -- Exports ------------------------------------------------------------------

export { createLinesInitialState, createLinesSlice };
