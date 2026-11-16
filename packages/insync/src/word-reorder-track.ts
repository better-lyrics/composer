import type { TimeRange } from "./group-shared-timing";
import { mergeWordsIntoTrack } from "./word-merge-track";
import type { WordTiming } from "./word-timing";
import { resolveOverlapsForward } from "./word-spaces";

// -- Functions ----------------------------------------------------------------

// Reorders a word track by pulling the dragged words out, shifting them by
// timeDelta, and re-inserting them via mergeWordsIntoTrack. Word and syllable
// boundaries are re-derived from the new positions rather than carried along
// with the stale trailing-space pattern, so a word that changes order with a
// neighbor cannot fuse into it.
function reorderWordTrack(
  track: WordTiming[],
  draggedIndices: ReadonlySet<number>,
  timeDelta: number,
  range: TimeRange,
): WordTiming[] {
  const moving = track.filter((_, index) => draggedIndices.has(index));
  const earliest = Math.min(...moving.map((word) => word.begin));
  const latest = Math.max(...moving.map((word) => word.end));
  // The dragged words move as one block, so clamping never reorders them.
  const delta = Math.max(range.min - earliest, Math.min(range.max - latest, timeDelta));
  const dragged: WordTiming[] = [];
  const rest: WordTiming[] = [];
  track.forEach((word, index) => {
    if (draggedIndices.has(index)) dragged.push({ ...word, begin: word.begin + delta, end: word.end + delta });
    else rest.push({ ...word });
  });
  return resolveOverlapsForward(mergeWordsIntoTrack(rest, dragged), range.max);
}

// -- Exports ------------------------------------------------------------------

export { reorderWordTrack };
