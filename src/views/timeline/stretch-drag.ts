import type { LyricLine } from "@/domain/line/model";
import type { WordTiming } from "@/domain/word/timing";
import {
  STRETCH_EPS,
  type StretchAnchor,
  type StretchClampOptions,
  type StretchSelectionRef,
  type StretchTargets,
  deriveBounds,
  isFiniteWord,
  resolveStretchTargets,
  trackWords,
} from "@/views/timeline/stretch-targets";
import { selectionGripEdges } from "@/views/timeline/stretch-grips";

// -- Types ---------------------------------------------------------------------

interface StretchDragRef {
  lineId: string;
  type: "word" | "bg";
  wordIndex: number;
  edge: "left" | "right";
}

interface StretchDragPlan {
  anchor: StretchAnchor;
  // Fixed point of the affine map (t0 for "start", t1 for "end").
  anchorTime: number;
  // Original time of the dragged edge (the opposite word-block extreme).
  edgeTime: number;
  minFactor: number;
  maxFactor: number;
  // Resolved once here; the drag remaps these every frame instead of re-resolving.
  targets: StretchTargets;
}

// -- Public API ----------------------------------------------------------------

// A block-edge drag becomes a proportional stretch only when the grip sits on
// the selection's own boundary: the left edge of the earliest selected word
// block (anchor "end") or the right edge of the latest one (anchor "start").
// Internal edges and single-word selections keep the plain resize behaviour —
// which is what makes arbitrary contiguous sub-ranges (e.g. CJK) stretchable.
function planStretchDrag(
  rawLines: LyricLine[],
  selections: ReadonlyArray<StretchSelectionRef>,
  drag: StretchDragRef,
  options: StretchClampOptions,
): StretchDragPlan | null {
  const targets = resolveStretchTargets(rawLines, selections);
  if (!targets) return null;

  // Single owner of "what is a grip": the dragged edge must be the selection's
  // grip on that side. This also enforces the 2+ block rule.
  const grips = selectionGripEdges(rawLines, selections);
  const grip = drag.edge === "right" ? grips.right : grips.left;
  if (!grip || grip.lineId !== drag.lineId || grip.type !== drag.type || grip.wordIndex !== drag.wordIndex) {
    return null;
  }

  const draggedTrack = targets.tracks.get(`${drag.lineId}:${drag.type}`);
  const draggedWords = draggedTrack ? trackWords(draggedTrack) : null;
  const draggedWord = draggedTrack?.indices.has(drag.wordIndex)
    ? (draggedWords?.[drag.wordIndex] as WordTiming | undefined)
    : undefined;
  if (!isFiniteWord(draggedWord)) return null;

  const anchor: StretchAnchor = drag.edge === "right" ? "start" : "end";
  const edgeTime = anchor === "start" ? draggedWord.end : draggedWord.begin;

  const bounds = deriveBounds(targets, { ...options, anchor });
  if (!bounds) return null;
  // Degenerate grip-to-anchor distance (possible only when a line-synced row
  // defines the anchor and both words sit on top of it).
  if (Math.abs(edgeTime - bounds.anchorTime) <= STRETCH_EPS) return null;

  return {
    anchor,
    anchorTime: bounds.anchorTime,
    edgeTime,
    minFactor: bounds.kLo,
    maxFactor: bounds.kHi,
    targets,
  };
}

// -- Exports -------------------------------------------------------------------

export { planStretchDrag };
