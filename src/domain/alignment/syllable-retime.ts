import type { WordInterval } from "@/domain/alignment/words";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";

// Times the syllables of a word the user just split, from the model, without
// moving the word: only the boundaries inside it change.

// -- Types --------------------------------------------------------------------

/** First and last word index of one syllable group. */
type GroupRange = [number, number];

// -- Functions ----------------------------------------------------------------

/** Syllable groups in `after` that `before` didn't have, or that gained or lost syllables. */
function newSyllableGroups(before: readonly WordTiming[] | undefined, after: WordTiming[]): GroupRange[] {
  const sizeBefore = new Map<string, number>();
  for (const word of before ?? []) {
    if (word.syllableGroupId) sizeBefore.set(word.syllableGroupId, (sizeBefore.get(word.syllableGroupId) ?? 0) + 1);
  }
  return computeSyllableGroups(after).flatMap(({ startIndex, endIndex }): GroupRange[] => {
    const id = after[startIndex].syllableGroupId;
    if (!id) return [];
    return sizeBefore.get(id) === endIndex - startIndex + 1 ? [] : [[startIndex, endIndex]];
  });
}

/**
 * Moves each group's inner boundaries to where the model put them, as a share
 * of the model's span for the whole word mapped onto the user's span, so the
 * word keeps its outer begin and end.
 */
function retimeInnerBoundaries(
  words: readonly WordTiming[],
  groups: readonly GroupRange[],
  model: readonly WordInterval[],
): WordTiming[] {
  const out = words.map((word) => ({ ...word }));
  for (const [first, last] of groups) {
    const modelBegin = model[first].begin;
    const modelSpan = model[last].end - modelBegin;
    const begin = words[first].begin;
    const span = words[last].end - begin;
    if (modelSpan <= 0 || span <= 0) continue;
    for (let k = first; k < last; k++) {
      const at = begin + (span * (model[k].end - modelBegin)) / modelSpan;
      out[k].end = at;
      out[k + 1].begin = at;
    }
  }
  return out;
}

// -- Exports ------------------------------------------------------------------

export { newSyllableGroups, retimeInnerBoundaries };
export type { GroupRange };
