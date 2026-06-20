import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LooseLine } from "@/domain/line/model";
import { expandSelectionToGroupmates } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

interface ExplicitToggleResult {
  newWords: WordTiming[];
  extraUpdates: Partial<LooseLine>;
}

// -- Operation ----------------------------------------------------------------

// Pure computation behind toggleWordExplicit: expands the selection to syllable
// groupmates, flips the explicit flag (set only when not all selected words are
// already marked), and stamps manual provenance for a background-words edit.
// Returns null when there is nothing to toggle so the caller can early-return.
function computeExplicitToggle(
  currentWords: WordTiming[],
  field: "words" | "backgroundWords",
  wordIndices: number[],
): ExplicitToggleResult | null {
  if (currentWords.length === 0) return null;

  const filtered = wordIndices.filter((i) => i >= 0 && i < currentWords.length);
  const expanded = expandSelectionToGroupmates(currentWords, filtered).filter((i) => i < currentWords.length);
  const indexSet = new Set(expanded);
  if (indexSet.size === 0) return null;

  const nextExplicit = !Array.from(indexSet).every((i) => currentWords[i].explicit === true);
  const newWords: WordTiming[] = currentWords.map((word, i) => {
    if (!indexSet.has(i)) return word;
    if (nextExplicit) return { ...word, explicit: true };
    const { explicit: _explicit, ...rest } = word;
    return rest;
  });

  const extraUpdates = field === "backgroundWords" ? manualBackgroundWordEdit(newWords) : {};
  return { newWords, extraUpdates };
}

// -- Exports ------------------------------------------------------------------

export { computeExplicitToggle };
export type { ExplicitToggleResult };
