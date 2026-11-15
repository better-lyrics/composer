import type { LyricLine } from "insync/line";
import {
  STRETCH_EPS,
  type StretchSelectionRef,
  resolveStretchTargets,
  selectedFiniteWords,
  selectionExtremes,
} from "@/domain/selection/stretch-targets";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types ---------------------------------------------------------------------

interface GripRef {
  lineId: string;
  type: "word" | "bg";
  wordIndex: number;
  syllableId: string;
  edge: "left" | "right";
}

interface SelectionGrips {
  left: GripRef | null;
  right: GripRef | null;
}

// -- Public API ----------------------------------------------------------------

// The two outer edges of a multi-block selection are the grips that trigger a
// proportional stretch: the left edge of the earliest selected word block and
// the right edge of the latest one. Only word blocks carry grips (line-synced
// rows ride along but never define an edge), and only when 2+ blocks are
// selected, mirroring planStretchDrag's qualification.
function selectionGripEdges(rawLines: LyricLine[], selections: ReadonlyArray<StretchSelectionRef>): SelectionGrips {
  const none: SelectionGrips = { left: null, right: null };
  const targets = resolveStretchTargets(rawLines, selections, getSplitCharacter());
  if (!targets) return none;

  const { t0, t1, count } = selectionExtremes(targets, getSplitCharacter());
  if (count < 2) return none;

  let left: GripRef | null = null;
  let right: GripRef | null = null;
  for (const { track, idx, word } of selectedFiniteWords(targets, getSplitCharacter())) {
    if (!left && Math.abs(word.begin - t0) <= STRETCH_EPS) {
      left = { lineId: track.line.id, type: track.type, wordIndex: idx, syllableId: word.id, edge: "left" };
    }
    if (!right && Math.abs(word.end - t1) <= STRETCH_EPS) {
      right = { lineId: track.line.id, type: track.type, wordIndex: idx, syllableId: word.id, edge: "right" };
    }
  }
  return { left, right };
}

// -- Exports -------------------------------------------------------------------

export type { SelectionGrips };
export { selectionGripEdges };
