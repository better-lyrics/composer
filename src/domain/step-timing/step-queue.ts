import type { LyricLine } from "@/domain/line/model";
import { addressKey, sameAddress } from "@/domain/selection/identity";
import type { SyllableAddress } from "@/domain/selection/model";
import { type ResolvedAddress, resolveAddresses } from "@/domain/selection/resolve";

// -- Functions ----------------------------------------------------------------

// Structural order, never time order: the timing being fixed is the stale part. Words that are gone drop.
function compareQueued(a: ResolvedAddress, b: ResolvedAddress): number {
  return a.lineIndex - b.lineIndex || Number(a.type === "bg") - Number(b.type === "bg") || a.wordIndex - b.wordIndex;
}

function queueOrder(lines: readonly LyricLine[], selections: readonly SyllableAddress[]): SyllableAddress[] {
  const seen = new Set<string>();
  const unique = selections.filter((selection) => {
    const key = addressKey(selection);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return resolveAddresses(lines, unique)
    .sort(compareQueued)
    .map(({ lineId, type, syllableId }) => ({ lineId, type, syllableId }));
}

// True when every queued word still resolves and the queue already runs in structural order.
function isInQueueOrder(lines: readonly LyricLine[], queue: readonly SyllableAddress[]): boolean {
  const resolved = resolveAddresses(lines, queue);
  if (resolved.length !== queue.length) return false;
  return resolved.every((address, index) => index === 0 || compareQueued(resolved[index - 1], address) < 0);
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

export { chainedNext, isInQueueOrder, nextInQueue, queueOrder };
