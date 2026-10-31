import type { DraftMark } from "@/domain/alignment/draft-timing";
import { useProjectStore } from "@/stores/project";
import { create } from "zustand";

// What the last line-timing draft placed, so its uncertain lines stay marked
// for review until the user edits them. Kept for the session only: a reload
// keeps the timing but drops the marks, and the drafted lines then count as
// the user's own.

// -- Types --------------------------------------------------------------------

interface DraftReviewState {
  marks: Readonly<Record<string, DraftMark>>;
  /** The last draft scored low over the whole song. */
  lowConfidence: boolean;
}

// -- Store --------------------------------------------------------------------

const useDraftReviewStore = create<DraftReviewState>(() => ({ marks: {}, lowConfidence: false }));

// Another project can reuse line ids; its lines aren't this draft's.
useProjectStore.subscribe((s, prev) => {
  if (s.projectSession !== prev.projectSession) useDraftReviewStore.setState({ marks: {}, lowConfidence: false });
});

// -- Exports ------------------------------------------------------------------

export { useDraftReviewStore };
