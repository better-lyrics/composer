import { sameWordSelection } from "@/domain/selection/identity";
import type { WordSelection } from "@/domain/selection/model";

// -- Functions ----------------------------------------------------------------

// Structural order, never time order: the timing being fixed is the stale part.
function queueOrder(selections: readonly WordSelection[]): WordSelection[] {
  const unique = selections.filter(
    (selection, index) => selections.findIndex((other) => sameWordSelection(other, selection)) === index,
  );
  return unique.toSorted(
    (a, b) =>
      a.lineIndex - b.lineIndex || Number(a.type === "bg") - Number(b.type === "bg") || a.wordIndex - b.wordIndex,
  );
}

function nextInQueue(queue: readonly WordSelection[], cursor: WordSelection): WordSelection | null {
  const index = queue.findIndex((selection) => sameWordSelection(selection, cursor));
  return index === -1 ? null : (queue[index + 1] ?? null);
}

// The word a step also starts: only the structural next word, and never across a track switch,
// except main words running on into the next line.
function chainedNext(
  cursor: WordSelection,
  next: WordSelection | null,
  structuralNext: WordSelection | null,
): WordSelection | null {
  if (!next || !structuralNext || !sameWordSelection(next, structuralNext)) return null;
  const sameTrack = next.lineId === cursor.lineId && next.type === cursor.type;
  return sameTrack || (next.type === "word" && cursor.type === "word") ? next : null;
}

// -- Exports ------------------------------------------------------------------

export { chainedNext, nextInQueue, queueOrder };
