import exceptions from "@/audio/alignment/hubertfa/readers/exceptions/es.json";
import {
  type Rule,
  type Spot,
  type WordReading,
  applyRules,
  atWordEnd,
  atWordStart,
  compileRules,
  letterBefore,
  letterClasses,
  listedReading,
  readWithRules,
  sameLetters,
  strongVowels,
} from "@/audio/alignment/hubertfa/readers/spelling";

// Latin American Spanish: seseo (z, and c before e/i, are s), yeísmo (ll and
// consonant y are j), h silent, b and v both b, no softening of b/d/g.

// -- Constants ----------------------------------------------------------------

const EXCEPTIONS: Readonly<Record<string, string>> = exceptions;

const { beforeFront, beforeVowel } = letterClasses("aeiouáéíóúü", "eiéí");
// rr, word-initial r and r after n, l or s are trilled; any other r is a tap.
const trilled = (spot: Spot) => atWordStart(spot) || "nls".includes(letterBefore(spot) || "-");

const RULES = compileRules([
  ...strongVowels("áa ée íi óo úu"),
  { letters: "ü", sounds: "u" },
  ...sameLetters("aeioubdfklmnpstw"),
  { letters: "v", sounds: "b" },
  { letters: "ch", sounds: "tʃ" },
  // English loans are common in the lyrics: "show", "shorty".
  { letters: "sh", sounds: "ʃ" },
  { letters: "c", sounds: "s", when: beforeFront },
  { letters: "c", sounds: "k" },
  { letters: "gu", sounds: "g", when: beforeFront },
  { letters: "g", sounds: "x", when: beforeFront },
  { letters: "g", sounds: "g" },
  { letters: "h", sounds: "" },
  { letters: "j", sounds: "x" },
  { letters: "ll", sounds: "j" },
  { letters: "ñ", sounds: "ɲ" },
  { letters: "qu", sounds: "k", when: beforeFront },
  { letters: "q", sounds: "k" },
  { letters: "rr", sounds: "r" },
  { letters: "r", sounds: (spot) => (trilled(spot) ? "r" : "ɾ") },
  { letters: "x", sounds: "k s" },
  // Consonant y before a vowel; the vowel y ("y", "hoy", "muy") otherwise.
  { letters: "y", sounds: (spot) => (beforeVowel(spot) && !atWordEnd(spot) ? "j" : "i") },
  { letters: "z", sounds: "s" },
] satisfies Rule[]);

// -- Functions ----------------------------------------------------------------

function readSpanish(word: string): WordReading {
  return readWithRules(word, (piece) => listedReading(piece, EXCEPTIONS) ?? applyRules(piece, RULES), {
    glide: true,
    diphthongs: "anywhere",
  });
}

// -- Exports ------------------------------------------------------------------

export { readSpanish };
