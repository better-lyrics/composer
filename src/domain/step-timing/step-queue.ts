import type { LyricLine } from "@/domain/line/model";
import { sameAddress } from "@/domain/selection/identity";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveAddresses } from "@/domain/selection/resolve";

// -- Functions ----------------------------------------------------------------

// Structural order, never time order: the timing being fixed is the stale part. Words that are gone drop.
function queueOrder(lines: readonly LyricLine[], selections: readonly SyllableAddress[]): SyllableAddress[] {
  const unique = selections.filter(
    (selection, index) => selections.findIndex((other) => sameAddress(other, selection)) === index,
  );
  return resolveAddresses(lines, unique)
    .sort(
      (a, b) =>
        a.lineIndex - b.lineIndex || Number(a.type === "bg") - Number(b.type === "bg") || a.wordIndex - b.wordIndex,
    )
    .map(({ lineId, type, syllableId }) => ({ lineId, type, syllableId }));
}

function nextInQueue(queue: readonly SyllableAddress[], cursor: SyllableAddress): SyllableAddress | null {
  const index = queue.findIndex((selection) => sameAddress(selection, cursor));
  return index === -1 ? null : (queue[index + 1] ?? null);
}

// The word a step also starts: only the structural next word, and never across a track switch,
// except main words running on into the next line.
function chainedNext<A extends SyllableAddress>(
  cursor: SyllableAddress,
  next: A | null,
  structuralNext: SyllableAddress | null,
): A | null {
  if (!next || !structuralNext || !sameAddress(next, structuralNext)) return null;
  const sameTrack = next.lineId === cursor.lineId && next.type === cursor.type;
  return sameTrack || (next.type === "word" && cursor.type === "word") ? next : null;
}

// -- Exports ------------------------------------------------------------------

export { chainedNext, nextInQueue, queueOrder };
