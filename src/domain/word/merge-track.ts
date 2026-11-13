import { withFreeIds } from "@/domain/word/id";
import { computeSyllableGroups } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { trimTrailingSpaceFromLast } from "@/utils/word-spaces";

// -- Types --------------------------------------------------------------------

interface TaggedWord {
  word: WordTiming;
  isIncoming: boolean;
}

// -- Functions ----------------------------------------------------------------

function incomingUnits(words: WordTiming[]): TaggedWord[][] {
  const runEndByStart = new Map(computeSyllableGroups(words).map((run) => [run.startIndex, run.endIndex]));
  const units: TaggedWord[][] = [];
  let index = 0;
  while (index < words.length) {
    const end = runEndByStart.get(index) ?? index;
    units.push(words.slice(index, end + 1).map((word) => ({ word, isIncoming: true })));
    index = end + 1;
  }
  return units;
}

// Merges incoming words into an existing word track in time order. Incoming words keep their
// own internal structure, an existing group with an incoming word in its gap is broken, and
// every seam between existing and incoming content becomes a word boundary. A spaceless joint makes reconstructLineText reinsert
// the split character, so the seam needs a real space in every mode.
function mergeWordsIntoTrack(existing: WordTiming[], incoming: WordTiming[]): WordTiming[] {
  if (incoming.length === 0) return existing;

  const freshIncoming = withFreeIds(incoming, existing);
  const existingUnits: TaggedWord[][] = existing.map((word) => [{ word, isIncoming: false }]);
  const tagged = [...existingUnits, ...incomingUnits(freshIncoming)]
    .sort((a, b) => a[0].word.begin - b[0].word.begin)
    .flat();

  const spaced = tagged.map((tag, index) => {
    const next = tagged[index + 1];
    if (!next || next.isIncoming === tag.isIncoming) return tag.word;
    const sep = tag.word.sep.endsWith(" ") ? tag.word.sep : `${tag.word.sep} `;
    return { ...tag.word, sep, joinsNext: false };
  });

  return trimTrailingSpaceFromLast(spaced);
}

// -- Exports ------------------------------------------------------------------

export { mergeWordsIntoTrack };
