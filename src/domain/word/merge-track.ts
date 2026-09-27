import { computeByGroupId } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { trimTrailingSpaceFromLast } from "@/utils/word-spaces";
import { nanoid } from "nanoid";

// -- Types --------------------------------------------------------------------

interface TaggedWord {
  word: WordTiming;
  isIncoming: boolean;
}

// -- Functions ----------------------------------------------------------------

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

function atomicUnits(words: WordTiming[], isIncoming: boolean): TaggedWord[][] {
  const runEndByStart = new Map(computeByGroupId(words).map((run) => [run.startIndex, run.endIndex]));
  const units: TaggedWord[][] = [];
  let index = 0;
  while (index < words.length) {
    const end = runEndByStart.get(index) ?? index;
    units.push(words.slice(index, end + 1).map((word) => ({ word, isIncoming })));
    index = end + 1;
  }
  return units;
}

// Merges incoming words into an existing word track. Incoming words keep their
// own internal structure; every seam between existing and incoming content
// becomes a word boundary. A spaceless joint makes reconstructLineText reinsert
// the split character, so the seam needs a real space in every mode.
function mergeWordsIntoTrack(existing: WordTiming[], incoming: WordTiming[]): WordTiming[] {
  if (incoming.length === 0) return existing;

  const freshIncoming = regenerateSyllableGroupIds(incoming);
  const tagged = [...atomicUnits(existing, false), ...atomicUnits(freshIncoming, true)]
    .sort((a, b) => a[0].word.begin - b[0].word.begin)
    .flat();

  const spaced = tagged.map((tag, index) => {
    const next = tagged[index + 1];
    if (!next || next.isIncoming === tag.isIncoming) return tag.word;
    if (tag.word.text.endsWith(" ")) return tag.word;
    return { ...tag.word, text: `${tag.word.text} ` };
  });

  return trimTrailingSpaceFromLast(spaced);
}

// -- Exports ------------------------------------------------------------------

export { mergeWordsIntoTrack };
