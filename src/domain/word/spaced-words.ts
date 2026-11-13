import { groupIdsForJoins, joinsFromWords, splitTrailingWhitespace } from "insync/from-words";
import { newWordId } from "@/domain/word/id";
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

function spacedFromWords(words: readonly WordTiming[]): SpacedWord[] {
  const spaced = words.map(({ sep, id: _id, joinsNext: _joins, ...word }) => ({ ...word, text: word.text + sep }));
  const ids = groupIdsForJoins(spaced.map(({ text }, index) => ({ text, joinsNext: words[index].joinsNext })));
  return spaced.map((word, index) => (ids[index] === undefined ? word : { ...word, syllableGroupId: ids[index] }));
}

// The words as typed: each word's text followed by its separator.
function spacedText(words: readonly WordTiming[]): string {
  return words.map((word) => word.text + word.sep).join("");
}

// -- Exports ------------------------------------------------------------------

export { spacedFromWords, spacedText, wordFromSpaced, wordsFromSpaced };
export type { SpacedWord };
