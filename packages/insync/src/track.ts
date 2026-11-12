import type { Ms } from "./time";

// -- Types --------------------------------------------------------------------

// One TTML span: part of a word, a word, or a block of words with one timing.
interface Syllable {
  readonly text: string;
  // The literal text written after this syllable ("", " ", "  ", U+3000, punctuation).
  readonly sep: string;
  // True when the next syllable belongs to the same word.
  readonly joinsNext: boolean;
  readonly span?: readonly [Ms, Ms];
}

type SyllableTrack = readonly Syllable[];

// -- Exports ------------------------------------------------------------------

export type { Syllable, SyllableTrack };
