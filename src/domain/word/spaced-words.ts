import { splitTrailingWhitespace } from "insync/from-words";
import { newWordId } from "@/domain/word/id";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

// Words as version 3 records, links and parsers spell them: the separator is
// trailing whitespace inside `text`, and ids are never written.
type SpacedWord = Omit<WordTiming, "sep" | "id"> & { id?: string };

// -- Conversion ---------------------------------------------------------------

function wordFromSpaced(word: SpacedWord): WordTiming {
  return { ...word, id: word.id ?? newWordId(), ...splitTrailingWhitespace(word.text) };
}

function wordsFromSpaced(words: readonly SpacedWord[]): WordTiming[] {
  return words.map(wordFromSpaced);
}

function spacedFromWords(words: readonly WordTiming[]): SpacedWord[] {
  return words.map(({ sep, id: _id, ...word }) => ({ ...word, text: word.text + sep }));
}

// The words as typed: each word's text followed by its separator.
function spacedText(words: readonly WordTiming[]): string {
  return words.map((word) => word.text + word.sep).join("");
}

// -- Exports ------------------------------------------------------------------

export { spacedFromWords, spacedText, wordFromSpaced, wordsFromSpaced };
export type { SpacedWord };
