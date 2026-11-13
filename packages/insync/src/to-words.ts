import { groupIdsForJoins } from "./from-words";
import { secondsFromMs } from "./time";
import type { SyllableTrack } from "./track";

// -- Types --------------------------------------------------------------------

interface WordsOutput {
  text: string;
  begin: number;
  end: number;
  syllableGroupId?: string;
}

// -- Conversion ---------------------------------------------------------------

// Ids go where a v3 load needs them to restore joinsNext (see groupIdsForJoins).
function wordsFromSyllables(track: SyllableTrack): WordsOutput[] {
  const timed = track.flatMap((syllable, index) => {
    if (!syllable.span) return [];
    const joinsNext = syllable.joinsNext && track[index + 1]?.span !== undefined;
    return [{ text: syllable.text + syllable.sep, joinsNext, span: syllable.span }];
  });
  const ids = groupIdsForJoins(timed);
  return timed.map(({ text, span }, index): WordsOutput => {
    const word = { text, begin: secondsFromMs(span[0]), end: secondsFromMs(span[1]) };
    return ids[index] === undefined ? word : { ...word, syllableGroupId: ids[index] };
  });
}

// -- Exports ------------------------------------------------------------------

export { wordsFromSyllables };
export type { WordsOutput };
