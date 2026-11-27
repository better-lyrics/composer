import exceptions from "@/audio/alignment/hubertfa/readers/exceptions/de.json";
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
} from "@/audio/alignment/hubertfa/readers/spelling";

// Standard German. ch is ç after front vowels and consonants and x after a, o,
// u and au; final devoicing; ei aj, au aw, eu and äu oj; sp and st start with
// ʃ at the start of a word; r is ʁ before a vowel and ɐ after one; a final -er
// is ɐ and -en is ə n. A vowel before two consonants is short (ɪ ʊ ɛ ɔ ʏ œ).

// -- Constants ----------------------------------------------------------------

const DEVOICED: Readonly<Record<string, string>> = { b: "p", d: "t", g: "k" };
// Endings whose e is the unstressed ə: "-e", "-en", "-em", "-el", "-es", "-et", "-end", "-ens".
const SCHWA_ENDINGS = ["e", "en", "em", "el", "es", "et", "end", "ens", "ern"];
const SHORT_LONG: Readonly<Record<string, readonly [string, string]>> = {
  i: ["ɪ", "i"],
  u: ["ʊ", "u"],
  e: ["ɛ", "e"],
  o: ["ɔ", "o"],
  ü: ["ʏ", "y"],
  y: ["ʏ", "y"],
  ö: ["œ", "ø"],
  ä: ["ɛ", "ɛ"],
  a: ["a", "a"],
};
const EXCEPTIONS: Readonly<Record<string, string>> = exceptions;

const { isVowelLetter, beforeVowel, afterVowel } = letterClasses("aeiouäöüy");
// "mehr", "ihr": the h only lengthens the vowel before the r.
const afterVowelOrH = (spot: Spot) =>
  afterVowel(spot) || (letterBefore(spot) === "h" && isVowelLetter(spot.word[spot.at - 2] ?? ""));
// Closes its syllable: the word ends, or a consonant follows.
const closesSyllable = (spot: Spot) => atWordEnd(spot) || !beforeVowel(spot);
const hasVowelBefore = (spot: Spot) => [...spot.word.slice(0, spot.at)].some(isVowelLetter);

// A vowel is short before two consonants or one at the end of a word, long
// before one consonant and a vowel, an h, a vocalised r or the end of the word.
function vowelLength(spot: Spot): "short" | "long" {
  const rest = spot.word.slice(spot.end);
  if (rest === "" || rest[0] === "h" || rest === "r" || (rest[0] === "r" && !isVowelLetter(rest[1] ?? ""))) {
    return "long";
  }
  const consonants = rest.length - rest.replace(/^[^aeiouäöüy]+/, "").length;
  const single = consonants === 1 || ["ch", "sch", "ph", "th"].includes(rest.slice(0, consonants));
  return single && consonants < rest.length ? "long" : "short";
}

// b, d and g are voiceless at the end of a syllable, but not before l or r ("Handlung" aside).
const devoicing = (letter: string): Rule => ({
  letters: letter,
  sounds: (spot) => (closesSyllable(spot) && !"lr".includes(letterAfter(spot) || "-") ? DEVOICED[letter] : letter),
});

const vowel = (letter: string): Rule => ({
  letters: letter,
  sounds: (spot) => SHORT_LONG[letter][vowelLength(spot) === "short" ? 0 : 1],
});

const RULES = compileRules([
  { letters: "ie", sounds: "i" },
  { letters: "ei", sounds: "aj" },
  { letters: "ey", sounds: "aj" },
  { letters: "ai", sounds: "aj" },
  { letters: "ay", sounds: "aj" },
  { letters: "au", sounds: "aw" },
  { letters: "eu", sounds: "oj" },
  { letters: "äu", sounds: "oj" },
  { letters: "aa", sounds: "a" },
  { letters: "ee", sounds: "e" },
  { letters: "oo", sounds: "o" },
  { letters: "er", sounds: "ɐ", when: (spot) => atWordEnd(spot) && hasVowelBefore(spot) },
  { letters: "ers", sounds: "ɐ s", when: (spot) => atWordEnd(spot) && hasVowelBefore(spot) },
  {
    letters: "e",
    sounds: "ə",
    when: (spot) => hasVowelBefore(spot) && SCHWA_ENDINGS.includes(spot.word.slice(spot.at)),
  },
  // The prefix ge- ("gesagt", "gemacht"), but not a short stem ("gern", "geht").
  {
    letters: "e",
    sounds: "ə",
    when: (spot) =>
      spot.at === 1 && spot.word[0] === "g" && spot.word.length > 4 && !beforeVowel(spot) && letterAfter(spot) !== "h",
  },
  ...[..."aeiouäöüy"].map(vowel),
  ...Object.keys(DEVOICED).map(devoicing),
  { letters: "ig", sounds: "ɪ ç", when: (spot) => hasVowelBefore(spot) && (atWordEnd(spot) || !beforeVowel(spot)) },
  { letters: "tsch", sounds: "tʃ" },
  { letters: "tch", sounds: "tʃ" },
  { letters: "sch", sounds: "ʃ" },
  { letters: "chs", sounds: "k s" },
  {
    letters: "ch",
    sounds: (spot) => {
      const before = spot.word.slice(Math.max(0, spot.at - 2), spot.at);
      if (before === "eu" || before === "äu") return "ç";
      return "aou".includes(letterBefore(spot) || "-") ? "x" : "ç";
    },
  },
  { letters: "ck", sounds: "k" },
  { letters: "c", sounds: "k" },
  { letters: "dt", sounds: "t" },
  { letters: "f", sounds: "f" },
  { letters: "h", sounds: "", when: afterVowel },
  { letters: "h", sounds: "h" },
  { letters: "j", sounds: "j" },
  { letters: "k", sounds: "k" },
  { letters: "l", sounds: "l" },
  { letters: "m", sounds: "m" },
  { letters: "ng", sounds: "ŋ" },
  { letters: "nk", sounds: "ŋ k" },
  { letters: "n", sounds: "n" },
  { letters: "pf", sounds: "p f" },
  { letters: "ph", sounds: "f" },
  { letters: "p", sounds: "p" },
  { letters: "qu", sounds: "k v" },
  { letters: "q", sounds: "k" },
  { letters: "r", sounds: "ʁ", when: (spot) => beforeVowel(spot) || !afterVowelOrH(spot) },
  { letters: "r", sounds: "ɐ" },
  { letters: "sp", sounds: "ʃ p", when: atWordStart },
  { letters: "st", sounds: "ʃ t", when: atWordStart },
  { letters: "ss", sounds: "s" },
  { letters: "ß", sounds: "s" },
  { letters: "s", sounds: "z", when: beforeVowel },
  { letters: "s", sounds: "s" },
  { letters: "th", sounds: "t" },
  { letters: "tz", sounds: "ts" },
  { letters: "t", sounds: "t" },
  { letters: "v", sounds: "f" },
  { letters: "w", sounds: "v" },
  { letters: "x", sounds: "k s" },
  { letters: "z", sounds: "ts" },
] satisfies Rule[]);

// -- Functions ----------------------------------------------------------------

function readGerman(word: string): WordReading {
  return readWithRules(word, (piece) => listedReading(piece, EXCEPTIONS) ?? applyRules(piece, RULES), {
    glide: false,
    diphthongs: "never",
  });
}

// -- Exports ------------------------------------------------------------------

export { readGerman };
