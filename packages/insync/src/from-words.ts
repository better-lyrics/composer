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

interface JoinedText {
  readonly text: string;
  readonly joinsNext: boolean;
}

// The v3 ids that make a load read back these joins. Older builds read any id as a syllable, so ids go
// only where the spacing would misread a join: on joined runs, or with none, one lone id on the first
// misread word to switch the load to ids.
function groupIdsForJoins(words: readonly JoinedText[]): (string | undefined)[] {
  const joins = words.map((word, index) => index < words.length - 1 && word.joinsNext);
  const read = joinsFromWords(words.map(({ text }) => ({ text })));
  const misread = read.findIndex((joinsNext, index) => joinsNext !== joins[index]);
  if (misread === -1) return words.map(() => undefined);
  let run = 0;
  const runOf = joins.map((_, index) => (index > 0 && !joins[index - 1] ? ++run : run));
  const joined = joins.map((joinsNext, index) => joinsNext || (index > 0 && joins[index - 1]));
  const anyJoined = joined.some(Boolean);
  return runOf.map((r, index) => ((anyJoined ? joined[index] : index === misread) ? `w${r}` : undefined));
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

export { groupIdsForJoins, joinsFromWords, splitTrailingWhitespace, syllablesFromWords };
export type { WordsInput };
