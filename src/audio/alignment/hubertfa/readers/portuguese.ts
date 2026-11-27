import exceptions from "@/audio/alignment/hubertfa/readers/exceptions/pt.json";
import {
  type Rule,
  type Spot,
  type WordReading,
  applyRules,
  atWordEnd,
  atWordStart,
  compileRules,
  letterAfter,
  letterBefore,
  letterClasses,
  listedReading,
  readWithRules,
  sameLetters,
} from "@/audio/alignment/hubertfa/readers/spelling";

// Brazilian Portuguese. Nasal vowels and diphthongs (ão, õe, final -em and
// -am); lh ʎ, nh ɲ, ch ʃ; t and d before an i sound are tʃ and dʒ; a final
// unstressed e or o is i or u; rr, a word-initial r and an r closing a syllable
// are h, any other r a tap; an l closing a syllable is w.

// -- Constants ----------------------------------------------------------------

const ACCENTED = new Set([..."áâàãéêíóôõú"]);
const VOICED = new Set([..."bdglmnrvz"]);
const NASAL_OF: Readonly<Record<string, string>> = {
  a: "ɐ~",
  â: "ɐ~",
  e: "e~",
  ê: "e~",
  é: "e~",
  i: "i~",
  í: "i~",
  o: "o~",
  ô: "o~",
  ó: "o~",
  u: "u~",
  ú: "u~",
};
const EXCEPTIONS: Readonly<Record<string, string>> = exceptions;

const { isVowelLetter, beforeFront, beforeVowel, afterVowel } = letterClasses("aáâàãeéêiíoóôõuúü", "eéêií");
// A letter closing its syllable: nothing or a consonant follows.
const closesSyllable = (spot: Spot) => atWordEnd(spot) || !isVowelLetter(letterAfter(spot));
// The unstressed final e or o, alone or before a plural s.
const isFinalUnstressed = (word: string, at: number) =>
  at === word.length - 1 || (at === word.length - 2 && word[word.length - 1] === "s");
// An i sound follows: i itself, or a final unstressed e.
const beforeISound = (spot: Spot) =>
  letterAfter(spot) === "i" ||
  letterAfter(spot) === "í" ||
  (letterAfter(spot) === "e" && isFinalUnstressed(spot.word, spot.end));
// A final -ia, -io or -ua with no written accent elsewhere is stressed on the i or u: "dia", "rio", "rua".
const stressedHiatus = (spot: Spot) =>
  "aeo".includes(letterAfter(spot) || "-") &&
  !isVowelLetter(letterBefore(spot)) &&
  isFinalUnstressed(spot.word, spot.end) &&
  ![...spot.word].some((letter) => ACCENTED.has(letter));
// A vowel and the m or n after it are one nasal vowel when no vowel follows: "ponte", "bom".
const nasalVowel = (vowel: string, nasal: string): Rule => ({
  letters: `${vowel}${nasal}`,
  sounds: NASAL_OF[vowel],
  when: (spot) => atWordEnd(spot) || (!isVowelLetter(letterAfter(spot)) && letterAfter(spot) !== "h"),
});

const RULES = compileRules([
  { letters: "ão", sounds: "ɐ~w" },
  { letters: "ãe", sounds: "ɐ~j" },
  { letters: "õe", sounds: "o~j" },
  { letters: "ã", sounds: "ɐ~" },
  { letters: "õ", sounds: "o~" },
  { letters: "am", sounds: "ɐ~w", when: atWordEnd },
  { letters: "em", sounds: "e~j", when: atWordEnd },
  { letters: "ém", sounds: "e~j", when: atWordEnd },
  { letters: "êm", sounds: "e~j", when: atWordEnd },
  { letters: "ens", sounds: "e~j s", when: atWordEnd },
  ...Object.keys(NASAL_OF).flatMap((vowel) => [nasalVowel(vowel, "m"), nasalVowel(vowel, "n")]),
  { letters: "á", sounds: "a!" },
  { letters: "à", sounds: "a" },
  { letters: "â", sounds: "ɐ!" },
  { letters: "é", sounds: "ɛ!" },
  { letters: "ê", sounds: "e!" },
  { letters: "í", sounds: "i!" },
  { letters: "ó", sounds: "ɔ!" },
  { letters: "ô", sounds: "o!" },
  { letters: "ú", sounds: "u!" },
  { letters: "ü", sounds: "u" },
  { letters: "e", sounds: "i", when: (spot) => isFinalUnstressed(spot.word, spot.at) },
  { letters: "o", sounds: "u", when: (spot) => isFinalUnstressed(spot.word, spot.at) },
  { letters: "i", sounds: "i!", when: stressedHiatus },
  // A final -iu is i and a u closing the syllable: "partiu".
  { letters: "iu", sounds: "i! u", when: atWordEnd },
  { letters: "u", sounds: "u!", when: (spot) => stressedHiatus(spot) && !"qg".includes(letterBefore(spot) || "-") },
  ...sameLetters("aeioubfkmnpvw"),
  { letters: "lh", sounds: "ʎ" },
  { letters: "nh", sounds: "ɲ" },
  { letters: "tch", sounds: "tʃ" },
  { letters: "ch", sounds: "ʃ" },
  { letters: "ç", sounds: "s" },
  { letters: "c", sounds: "s", when: beforeFront },
  { letters: "c", sounds: "k" },
  { letters: "d", sounds: "dʒ", when: beforeISound },
  { letters: "d", sounds: "d" },
  { letters: "t", sounds: "tʃ", when: beforeISound },
  { letters: "t", sounds: "t" },
  { letters: "gu", sounds: "g", when: beforeFront },
  { letters: "g", sounds: "ʒ", when: beforeFront },
  { letters: "g", sounds: "g" },
  { letters: "qu", sounds: "k", when: beforeFront },
  { letters: "q", sounds: "k" },
  { letters: "j", sounds: "ʒ" },
  { letters: "h", sounds: "" },
  { letters: "l", sounds: "w", when: (spot) => closesSyllable(spot) && afterVowel(spot) },
  { letters: "l", sounds: "l" },
  { letters: "rr", sounds: "h" },
  {
    letters: "r",
    sounds: (spot) =>
      atWordStart(spot) || closesSyllable(spot) || "nls".includes(letterBefore(spot) || "-") ? "h" : "ɾ",
  },
  { letters: "ss", sounds: "s" },
  { letters: "sc", sounds: "s", when: beforeFront },
  { letters: "s", sounds: "z", when: (spot) => afterVowel(spot) && beforeVowel(spot) },
  { letters: "s", sounds: "z", when: (spot) => VOICED.has(letterAfter(spot)) },
  { letters: "s", sounds: "s" },
  { letters: "x", sounds: "z", when: (spot) => spot.at === 1 && spot.word[0] === "e" && beforeVowel(spot) },
  { letters: "x", sounds: "s", when: (spot) => spot.at === 1 && spot.word[0] === "e" },
  { letters: "x", sounds: "ʃ" },
  { letters: "y", sounds: "i" },
  { letters: "z", sounds: "s", when: atWordEnd },
  { letters: "z", sounds: "z" },
] satisfies Rule[]);

// -- Functions ----------------------------------------------------------------

function readPortuguese(word: string): WordReading {
  return readWithRules(word, (piece) => listedReading(piece, EXCEPTIONS) ?? applyRules(piece, RULES), {
    glide: true,
    diphthongs: "anywhere",
  });
}

// -- Exports ------------------------------------------------------------------

export { readPortuguese };
