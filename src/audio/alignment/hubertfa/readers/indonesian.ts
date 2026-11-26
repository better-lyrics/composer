import exceptions from "@/audio/alignment/hubertfa/readers/exceptions/id.json";
import {
  type Rule,
  type WordReading,
  applyRules,
  atWordEnd,
  compileRules,
  listedReading,
  readWithRules,
  sameLetters,
} from "@/audio/alignment/hubertfa/readers/spelling";

// Indonesian and Malay, one reader. e is ə unless written é or listed as an
// exception; c is tʃ, j is dʒ, ny ɲ, ng ŋ, sy ʃ, kh x. A final k is the glottal
// stop it's sung as. ai, au and oi are diphthongs only at the end of a word
// ("pantai", "pulau"); inside one they are two syllables ("main", "laut").

// -- Constants ----------------------------------------------------------------

const EXCEPTIONS: Readonly<Record<string, string>> = exceptions;

const RULES = compileRules([
  ...sameLetters("aioubdfghlmnprstvwz"),
  { letters: "e", sounds: "ə" },
  { letters: "é", sounds: "e" },
  { letters: "è", sounds: "ɛ" },
  { letters: "c", sounds: "tʃ" },
  { letters: "j", sounds: "dʒ" },
  { letters: "kh", sounds: "x" },
  { letters: "k", sounds: "ʔ", when: atWordEnd },
  { letters: "k", sounds: "k" },
  { letters: "ny", sounds: "ɲ" },
  { letters: "ng", sounds: "ŋ" },
  { letters: "sy", sounds: "ʃ" },
  { letters: "q", sounds: "k" },
  { letters: "x", sounds: "k s" },
  { letters: "y", sounds: "j" },
] satisfies Rule[]);

// -- Functions ----------------------------------------------------------------

function readIndonesian(word: string): WordReading {
  return readWithRules(word, (piece) => listedReading(piece, EXCEPTIONS) ?? applyRules(piece, RULES), {
    glide: false,
    diphthongs: "final",
  });
}

// -- Exports ------------------------------------------------------------------

export { readIndonesian };
