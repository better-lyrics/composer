import {
  type Rule,
  type WordReading,
  applyRules,
  compileRules,
  readWithRules,
  sameLetters,
} from "@/audio/alignment/hubertfa/readers/spelling";

// Turkish spelling is close to one letter, one sound. ğ is no sound of its own
// (it lengthens the vowel before it, and there is no vowel length here); y is
// the consonant j, which joins the vowel before it as a diphthong when no
// vowel follows ("hey", "ayna").

// -- Constants ----------------------------------------------------------------

const RULES = compileRules([
  ...sameLetters("aeioubdfghklmnpstvz"),
  { letters: "â", sounds: "a" },
  { letters: "î", sounds: "i" },
  { letters: "û", sounds: "u" },
  { letters: "ı", sounds: "ɯ" },
  { letters: "ö", sounds: "œ" },
  { letters: "ü", sounds: "y" },
  { letters: "c", sounds: "dʒ" },
  { letters: "ç", sounds: "tʃ" },
  { letters: "ğ", sounds: "" },
  { letters: "j", sounds: "ʒ" },
  { letters: "r", sounds: "ɾ" },
  { letters: "ş", sounds: "ʃ" },
  { letters: "y", sounds: "j" },
  { letters: "q", sounds: "k" },
  { letters: "w", sounds: "v" },
  { letters: "x", sounds: "k s" },
] satisfies Rule[]);

// -- Functions ----------------------------------------------------------------

function readTurkish(word: string): WordReading {
  // Turkish lowercases dotted İ to i and plain I to dotless ı.
  const lowered = word.replaceAll("İ", "i").replaceAll("I", "ı");
  return readWithRules(lowered, (piece) => applyRules(piece, RULES), { glide: false, diphthongs: "never" });
}

// -- Exports ------------------------------------------------------------------

export { readTurkish };
