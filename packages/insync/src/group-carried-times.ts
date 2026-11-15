import type { Syllable } from "./line";
import { isTimedSyllable } from "./line-track";

// -- Types --------------------------------------------------------------------

type CarriedTimes = readonly [number, number] | "untimed" | null;

// -- Functions ----------------------------------------------------------------

// Syllables of the line the edit left on their times keep the instance's times. A syllable carried in from elsewhere, as
// a moved one is, takes the gap it sits in when its times would overlap the one before it or pass the kept one after it.
function inSongOrder(
  before: readonly Syllable[],
  after: readonly Syllable[],
  times: readonly CarriedTimes[],
): CarriedTimes[] {
  const untouched = new Map(before.flatMap((syllable) => (isTimedSyllable(syllable) ? [[syllable.id, syllable]] : [])));
  const kept = after.map((syllable) => {
    const previous = untouched.get(syllable.id);
    return isTimedSyllable(syllable) && previous?.begin === syllable.begin && previous.end === syllable.end;
  });
  const nextKeptBegin: number[] = [];
  let upcoming = Number.POSITIVE_INFINITY;
  for (let index = times.length - 1; index >= 0; index--) {
    nextKeptBegin[index] = upcoming;
    const span = times[index];
    if (kept[index] && Array.isArray(span)) upcoming = span[0];
  }
  let latestEnd = Number.NEGATIVE_INFINITY;
  return times.map((span, index) => {
    if (!Array.isArray(span)) return span;
    if (!kept[index] && (span[0] < latestEnd || span[1] > nextKeptBegin[index])) return null;
    latestEnd = Math.max(latestEnd, span[1]);
    return span;
  });
}

// -- Exports ------------------------------------------------------------------

export type { CarriedTimes };
export { inSongOrder };
