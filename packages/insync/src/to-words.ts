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

// Ids name each word run so a v3 load restores joinsNext whatever the whitespace.
function wordsFromSyllables(track: SyllableTrack): WordsOutput[] {
  const withIds = track.length > 1;
  let run = 0;
  return track.flatMap((syllable) => {
    const syllableGroupId = `w${run}`;
    if (!syllable.joinsNext) run += 1;
    if (!syllable.span) return [];
    const word: WordsOutput = {
      text: syllable.text + syllable.sep,
      begin: secondsFromMs(syllable.span[0]),
      end: secondsFromMs(syllable.span[1]),
    };
    return [withIds ? { ...word, syllableGroupId } : word];
  });
}

// -- Exports ------------------------------------------------------------------

export { wordsFromSyllables };
export type { WordsOutput };
