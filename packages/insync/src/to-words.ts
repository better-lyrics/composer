import { secondsFromMs } from "./time";
import type { SyllableTrack } from "./track";

// -- Types --------------------------------------------------------------------

interface WordsOutput {
  text: string;
  begin: number;
  end: number;
}

// -- Conversion ---------------------------------------------------------------

function wordsFromSyllables(track: SyllableTrack): WordsOutput[] {
  return track.flatMap((syllable) =>
    syllable.span
      ? [{ text: syllable.text + syllable.sep, begin: secondsFromMs(syllable.span[0]), end: secondsFromMs(syllable.span[1]) }]
      : [],
  );
}

// -- Exports ------------------------------------------------------------------

export { wordsFromSyllables };
export type { WordsOutput };
