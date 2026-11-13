import type { WordTiming } from "@/domain/word/timing";
import { applySiblingWords } from "@/utils/word-diff";

// -- Smart-sync propagation ---------------------------------------------------

// Propagates a source line's word change onto one linked sibling.
//
// Fast path: when the word count is unchanged this is a pure text rename, so
// only sibling word texts, separators and joins update and timing stays exact (skips the LCS diff).
// Structural change: defers to the smart-sync diff, which preserves sibling
// timing for words that did not structurally change.
//
// Returns undefined when there is nothing to propagate.
function propagateWordChanges(
  sourceAfter: WordTiming[] | undefined,
  sourceBefore: WordTiming[] | undefined,
  siblingWords: WordTiming[] | undefined,
): WordTiming[] | undefined {
  if (!sourceAfter || !siblingWords) return undefined;

  if (sourceBefore && sourceAfter.length === sourceBefore.length) {
    if (sourceAfter.length === siblingWords.length) {
      let changed = false;
      const next = siblingWords.map((w, i) => {
        const { text, sep, joinsNext } = sourceAfter[i];
        if (w.text === text && w.sep === sep && w.joinsNext === joinsNext) return w;
        changed = true;
        return { ...w, text, sep, joinsNext };
      });
      return changed ? next : undefined;
    }
    const unchanged = sourceAfter.every(
      (w, i) =>
        w.text === sourceBefore[i].text && w.sep === sourceBefore[i].sep && w.joinsNext === sourceBefore[i].joinsNext,
    );
    if (unchanged) return undefined;
  }

  const result = applySiblingWords(sourceAfter, sourceBefore, siblingWords);
  return result ?? undefined;
}

// -- Exports ------------------------------------------------------------------

export { propagateWordChanges };
