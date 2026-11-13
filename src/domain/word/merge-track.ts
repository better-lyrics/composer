import { withFreeIds } from "@/domain/word/id";
import { endedWord } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";
import { trimTrailingSpaceFromLast } from "@/utils/word-spaces";

// -- Types --------------------------------------------------------------------

interface TaggedWord {
  word: WordTiming;
  isIncoming: boolean;
}

// -- Functions ----------------------------------------------------------------

function beginsInGap(others: readonly WordTiming[], before: WordTiming, after: WordTiming): boolean {
  return others.some((other) => other.begin >= before.end && other.begin < after.begin);
}

// An incoming group moves as one unit so overlapping syllables stay together, but it breaks where an
// existing word begins in a gap between two of its syllables, so the track stays in time order.
function incomingUnits(words: WordTiming[], existing: readonly WordTiming[]): TaggedWord[][] {
  const units: TaggedWord[][] = [];
  words.forEach((word, index) => {
    const previous = words[index - 1];
    const sameUnit = index > 0 && previous.joinsNext && !beginsInGap(existing, previous, word);
    if (sameUnit) units[units.length - 1].push({ word, isIncoming: true });
    else units.push([{ word, isIncoming: true }]);
  });
  return units;
}

// Merges incoming words into an existing word track in time order. Incoming words keep their own
// internal structure, and every seam between existing and incoming content, or any join whose
// syllable no longer follows it, becomes a word boundary.
function mergeWordsIntoTrack(existing: WordTiming[], incoming: WordTiming[]): WordTiming[] {
  if (incoming.length === 0) return existing;

  const freshIncoming = withFreeIds(incoming, existing);
  const successor = new Map<WordTiming, WordTiming>();
  for (const words of [existing, freshIncoming]) words.forEach((word, i) => successor.set(word, words[i + 1]));
  const existingUnits = existing.map((word): TaggedWord[] => [{ word, isIncoming: false }]);
  const tagged = [...existingUnits, ...incomingUnits(freshIncoming, existing)]
    .sort((a, b) => a[0].word.begin - b[0].word.begin)
    .flat();

  const spaced = tagged.map((tag, index) => {
    const next = tagged[index + 1];
    if (!next) return tag.word;
    const seam = next.isIncoming !== tag.isIncoming;
    const brokenJoin = tag.word.joinsNext && successor.get(tag.word) !== next.word;
    return seam || brokenJoin ? endedWord(tag.word) : tag.word;
  });

  return trimTrailingSpaceFromLast(spaced);
}

// -- Exports ------------------------------------------------------------------

export { mergeWordsIntoTrack };
