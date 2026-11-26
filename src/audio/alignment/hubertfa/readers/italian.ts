import exceptions from "@/audio/alignment/hubertfa/readers/exceptions/it.json";
import {
  type Rule,
  type WordReading,
  applyRules,
  compileRules,
  letterAfter,
  letterClasses,
  listedReading,
  readWithRules,
  sameLetters,
  strongVowels,
} from "@/audio/alignment/hubertfa/readers/spelling";

// Standard Italian: soft c/g/sc before e and i, with the i that only marks
// softness silent before another vowel ("ciao", "giorno", "lasciare"); gli is
// ʎ, gn is ɲ, z is ts and r is trilled.

// -- Constants ----------------------------------------------------------------

// s is voiced before a voiced consonant ("sveglio", "sbaglio").
const VOICED = new Set([..."bdglmnrv"]);
const EXCEPTIONS: Readonly<Record<string, string>> = exceptions;

const { beforeFront, beforeVowel } = letterClasses("aeiouàèéìòóù", "eièéì");

// A soft consonant spelled with an i that is silent before a vowel ("cia", "gio", "scia").
const soft = (letters: string, sound: string): Rule[] => [
  { letters: `${letters}i`, sounds: sound, when: beforeVowel },
  { letters, sounds: sound, when: beforeFront },
];

const RULES = compileRules([
  ...strongVowels("àa èɛ ée ìi òɔ óo ùu"),
  ...sameLetters("aeioubdfjklmnprstvw"),
  { letters: "cch", sounds: "k" },
  { letters: "ch", sounds: "k" },
  ...soft("cc", "tʃ"),
  ...soft("c", "tʃ"),
  { letters: "c", sounds: "k" },
  { letters: "sch", sounds: "s k" },
  { letters: "s", sounds: "z", when: (spot) => VOICED.has(letterAfter(spot)) },
  ...soft("sc", "ʃ"),
  { letters: "ggh", sounds: "g" },
  { letters: "gh", sounds: "g" },
  { letters: "gli", sounds: "ʎ", when: beforeVowel },
  { letters: "gli", sounds: "ʎ i" },
  { letters: "gn", sounds: "ɲ" },
  ...soft("gg", "dʒ"),
  ...soft("g", "dʒ"),
  { letters: "g", sounds: "g" },
  { letters: "h", sounds: "" },
  { letters: "q", sounds: "k" },
  { letters: "x", sounds: "k s" },
  { letters: "y", sounds: "i" },
  { letters: "z", sounds: "ts" },
] satisfies Rule[]);

// -- Functions ----------------------------------------------------------------

function readItalian(word: string): WordReading {
  return readWithRules(word, (piece) => listedReading(piece, EXCEPTIONS) ?? applyRules(piece, RULES), {
    glide: true,
    diphthongs: "anywhere",
  });
}

// -- Exports ------------------------------------------------------------------

export { readItalian };
