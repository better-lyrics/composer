import { extractLinkedFields } from "@/domain/group/linking";
import { propagateWordChanges } from "@/domain/group/smart-sync";
import { withSeededBackground } from "@/domain/line/background";
import { type LooseLine, type LyricLine, reconcileLine } from "@/domain/line/model";

// -- Sibling update -----------------------------------------------------------

function updatedLinkedSibling(sibling: LyricLine, sourceBefore: LyricLine, updates: Partial<LyricLine>): LyricLine {
  const siblingUpdates: Partial<LooseLine> = extractLinkedFields(updates);
  const words = propagateWordChanges(updates.words, sourceBefore.words, sibling.words);
  if (words) siblingUpdates.words = words;
  const backgroundWords = propagateWordChanges(
    updates.backgroundWords,
    sourceBefore.backgroundWords,
    sibling.backgroundWords,
  );
  if (backgroundWords) siblingUpdates.backgroundWords = backgroundWords;
  if (Object.keys(siblingUpdates).length === 0) return sibling;
  return withSeededBackground(reconcileLine({ ...sibling, ...siblingUpdates }));
}

// -- Exports ------------------------------------------------------------------

export { updatedLinkedSibling };
