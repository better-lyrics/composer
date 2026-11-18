import type { Syllable, SyllableTrack } from "./track";

// -- Reads --------------------------------------------------------------------

function trackText(track: SyllableTrack): string {
  return track.map((syllable) => syllable.text + syllable.sep).join("");
}

function trackWords(track: SyllableTrack): Syllable[][] {
  const words: Syllable[][] = [];
  let current: Syllable[] = [];
  for (const syllable of track) {
    current.push(syllable);
    if (!syllable.joinsNext) {
      words.push(current);
      current = [];
    }
  }
  if (current.length > 0) words.push(current);
  return words;
}

// -- Exports ------------------------------------------------------------------

export { trackText, trackWords };
