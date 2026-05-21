import type { WordTiming } from "@/domain/word/timing";
import { nanoid } from "nanoid";

// -- Helpers ------------------------------------------------------------------

function regenerateSyllableGroupIds(words: WordTiming[]): WordTiming[] {
  const remapped = new Map<string, string>();
  let changed = false;
  const result = words.map((word) => {
    if (word.syllableGroupId === undefined) return word;
    let fresh = remapped.get(word.syllableGroupId);
    if (fresh === undefined) {
      fresh = nanoid(8);
      remapped.set(word.syllableGroupId, fresh);
    }
    changed = true;
    return { ...word, syllableGroupId: fresh };
  });
  return changed ? result : words;
}

// -- Functions ----------------------------------------------------------------

function mergePastedWords(existing: WordTiming[], pasted: WordTiming[]): WordTiming[] {
  if (pasted.length === 0) return existing;

  const freshPasted = regenerateSyllableGroupIds(pasted);
  const tagged = [
    ...existing.map((word) => ({ word, isPasted: false })),
    ...freshPasted.map((word) => ({ word, isPasted: true })),
  ].sort((a, b) => a.word.begin - b.word.begin);

  const usesSyllableGroupId = tagged.some((tag) => tag.word.syllableGroupId !== undefined);
  if (usesSyllableGroupId) return tagged.map((tag) => tag.word);

  return tagged.map((tag, index) => {
    const next = tagged[index + 1];
    if (!next || next.isPasted === tag.isPasted) return tag.word;
    if (tag.word.text.endsWith(" ")) return tag.word;
    return { ...tag.word, text: `${tag.word.text} ` };
  });
}

// -- Exports ------------------------------------------------------------------

export { mergePastedWords };
