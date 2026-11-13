import { joinsFromWords, splitTrailingWhitespace } from "insync/from-words";
import { newWordId } from "@/domain/word/id";
import { syllableRunIndices } from "@/domain/word/syllable-groups";
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

// One id per word run on every word, so a load restores joinsNext whatever the spacing.
function spacedFromWords(words: readonly WordTiming[]): SpacedWord[] {
  const runOf = syllableRunIndices(words);
  const withIds = words.length > 1;
  return words.map(({ sep, id: _id, joinsNext: _joins, ...word }, index) => ({
    ...word,
    text: word.text + sep,
    ...(withIds && { syllableGroupId: `w${runOf[index]}` }),
  }));
}

// The words as typed: each word's text followed by its separator.
function spacedText(words: readonly WordTiming[]): string {
  return words.map((word) => word.text + word.sep).join("");
}

// -- Exports ------------------------------------------------------------------

export { spacedFromWords, spacedText, wordFromSpaced, wordsFromSpaced };
export type { SpacedWord };
