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

type JoinInput = Pick<WordsInput, "text" | "syllableGroupId">;

function joinsNextByIds(words: readonly JoinInput[], index: number): boolean {
  const id = words[index].syllableGroupId;
  return id !== undefined && words[index + 1]?.syllableGroupId === id;
}

// Only a trailing ASCII space ends a word today; U+3000 and tabs still join.
function joinsNextBySpace(words: readonly JoinInput[], index: number): boolean {
  return index < words.length - 1 && !words[index].text.endsWith(" ");
}

function joinsFromWords(words: readonly JoinInput[]): boolean[] {
  const byIds = words.some((word) => word.syllableGroupId !== undefined);
  return words.map((_, index) => (byIds ? joinsNextByIds(words, index) : joinsNextBySpace(words, index)));
}

function syllablesFromWords(words: readonly WordsInput[]): SyllableTrack {
  const joins = joinsFromWords(words);
  return words.map(
    (word, index): Syllable => ({
      ...splitTrailingWhitespace(word.text),
      joinsNext: joins[index],
      span: [msFromSeconds(word.begin), msFromSeconds(word.end)],
    }),
  );
}

// -- Exports ------------------------------------------------------------------

export { joinsFromWords, splitTrailingWhitespace, syllablesFromWords };
export type { WordsInput };
