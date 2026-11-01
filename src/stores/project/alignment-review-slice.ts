import { type AlignedTimings, timingFingerprint } from "@/domain/alignment/fingerprint";
import type { ProjectStore } from "@/stores/project/types";
import type { StateCreator } from "zustand";

// -- Types --------------------------------------------------------------------

interface AlignmentReviewState {
  alignedTimings: AlignedTimings;
  alignmentNoticeDismissed: boolean;
}

interface AlignmentReviewActions {
  recordAlignedTimings: (lineIds: readonly string[]) => void;
  restoreAlignmentReview: (alignedTimings: AlignedTimings, dismissed: boolean) => void;
  dismissAlignmentNotice: () => void;
}

// -- Initial State ------------------------------------------------------------

function createAlignmentReviewInitialState(): AlignmentReviewState {
  return { alignedTimings: {}, alignmentNoticeDismissed: false };
}

// -- Slice --------------------------------------------------------------------

const createAlignmentReviewSlice: StateCreator<ProjectStore, [], [], AlignmentReviewState & AlignmentReviewActions> = (
  set,
) => ({
  ...createAlignmentReviewInitialState(),

  recordAlignedTimings: (lineIds) =>
    set((state) => {
      const linesById = new Map(state.lines.map((line) => [line.id, line]));
      const alignedTimings: AlignedTimings = { ...state.alignedTimings };
      for (const id of lineIds) {
        const line = linesById.get(id);
        if (line) alignedTimings[id] = timingFingerprint(line);
      }
      return { alignedTimings, alignmentNoticeDismissed: false, isDirty: true };
    }),

  restoreAlignmentReview: (alignedTimings, dismissed) => set({ alignedTimings, alignmentNoticeDismissed: dismissed }),

  dismissAlignmentNotice: () => set({ alignmentNoticeDismissed: true, isDirty: true }),
});

// -- Exports ------------------------------------------------------------------

export { createAlignmentReviewInitialState, createAlignmentReviewSlice };
export type { AlignmentReviewActions, AlignmentReviewState };
