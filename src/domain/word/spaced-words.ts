import { joinsFromWords, splitTrailingWhitespace } from "insync/from-words";
import { newWordId } from "@/domain/word/id";
import { isInSyllableGroup, syllableRunIndices } from "@/domain/word/syllable-groups";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

// Words as version 3 records, links and parsers spell them: the separator is trailing whitespace
// inside `text`, joins are `syllableGroupId` runs or a missing trailing space, and ids are never written.
type SpacedWord = Omit<WordTiming, "sep" | "id" | "joinsNext"> & { id?: string; syllableGroupId?: string };

// -- Conversion ---------------------------------------------------------------

// One word re-spelled from spaced text keeps its join; a new one stands alone.
function wordFromSpaced({ syllableGroupId: _group, ...word }: SpacedWord & { joinsNext?: boolean }): WordTiming {
  return {
    ...word,
    id: word.id ?? newWordId(),
    ...splitTrailingWhitespace(word.text),
    joinsNext: word.joinsNext ?? false,
  };
}

function wordsFromSpaced(words: readonly SpacedWord[]): WordTiming[] {
  const joins = joinsFromWords(words);
  return words.map(({ syllableGroupId: _group, ...word }, index) => ({
    ...word,
    id: word.id ?? newWordId(),
    ...splitTrailingWhitespace(word.text),
    joinsNext: joins[index],
  }));
}

// Ids go only where the spacing would read a different join on load, and only on joined runs, since
// older builds read any id as a syllable. With no joined run, one lone id switches the load to ids.
function spacedFromWords(words: readonly WordTiming[]): SpacedWord[] {
  const spaced = words.map(({ sep, id: _id, joinsNext: _joins, ...word }) => ({ ...word, text: word.text + sep }));
  const runOf = syllableRunIndices(words);
  const read = joinsFromWords(spaced);
  const misread = read.findIndex((joins, index) => joins !== (runOf[index] === runOf[index + 1]));
  if (misread === -1) return spaced;
  const joined = words.some((_, index) => isInSyllableGroup(words, index));
  const marked = (index: number) => (joined ? isInSyllableGroup(words, index) : index === misread);
  return spaced.map((word, index) => (marked(index) ? { ...word, syllableGroupId: `w${runOf[index]}` } : word));
}

// The words as typed: each word's text followed by its separator.
function spacedText(words: readonly WordTiming[]): string {
  return words.map((word) => word.text + word.sep).join("");
}

// -- Exports ------------------------------------------------------------------

export { spacedFromWords, spacedText, wordFromSpaced, wordsFromSpaced };
export type { SpacedWord };
