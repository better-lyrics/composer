import { msFromSeconds } from "./time";
import type { Syllable, SyllableTrack } from "./track";

// -- Types --------------------------------------------------------------------

// The fields of the app's WordTiming that carry text, timing and structure.
interface WordsInput {
  readonly text: string;
  readonly begin: number;
  readonly end: number;
  readonly syllableGroupId?: string;
}

// -- Conversion ---------------------------------------------------------------

function splitTrailingWhitespace(text: string): { text: string; sep: string } {
  const body = text.trimEnd();
  return { text: body, sep: text.slice(body.length) };
}

function joinsNextByIds(words: readonly WordsInput[], index: number): boolean {
  const id = words[index].syllableGroupId;
  return id !== undefined && words[index + 1]?.syllableGroupId === id;
}

// Only a trailing ASCII space ends a word today; U+3000 and tabs still join.
function joinsNextBySpace(words: readonly WordsInput[], index: number): boolean {
  return index < words.length - 1 && !words[index].text.endsWith(" ");
}

function syllablesFromWords(words: readonly WordsInput[]): SyllableTrack {
  const byIds = words.some((word) => word.syllableGroupId !== undefined);
  return words.map((word, index): Syllable => {
    const { text, sep } = splitTrailingWhitespace(word.text);
    return {
      text,
      sep,
      joinsNext: byIds ? joinsNextByIds(words, index) : joinsNextBySpace(words, index),
      span: [msFromSeconds(word.begin), msFromSeconds(word.end)],
    };
  });
}

// -- Exports ------------------------------------------------------------------

export { splitTrailingWhitespace, syllablesFromWords };
export type { WordsInput };
