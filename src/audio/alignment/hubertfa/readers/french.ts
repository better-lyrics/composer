import exceptions from "@/audio/alignment/hubertfa/readers/exceptions/fr.json";
import {
  type Rule,
  type Spot,
  type WordReading,
  applyRules,
  compileRules,
  letterAfter,
  letterBefore,
  letterClasses,
  listedReading,
  readWithRules,
} from "@/audio/alignment/hubertfa/readers/spelling";

// French, without liaison. Final consonants are silent except c, r, f and l
// (-er is e); a final mute e is silent except in one-syllable words; the verb
// ending -ent is silent; a vowel with n or m is nasal unless a vowel or a
// doubled n/m follows; r is ʁ. Irregular words are in the exceptions table.

// -- Constants ----------------------------------------------------------------

const SILENT_FINALS = new Set([..."stdxzpgh"]);
const EXCEPTIONS: Readonly<Record<string, string>> = exceptions;

const { isVowelLetter, beforeFront, beforeVowel, afterVowel } = letterClasses("aàâeéèêëiîïoôuùûüyœæ", "eéèêëiîïy");
// Vowel groups, with the u of qu and gu not counted: "que" has one, "aimer" two.
const vowelCount = (text: string) =>
  (
    text
      .replaceAll("qu", "q")
      .replaceAll("gu", "g")
      .match(/[aàâeéèêëiîïoôuùûüyœæ]+/g) ?? []
  ).length;
// A vowel letter just before a final e, es or ent: "vie", "rues", "jouent". The ending is silent after it.
const vowelBeforeEnding = (word: string, ending: string) => {
  const plain = word.replaceAll("qu", "q").replaceAll("gu", "g");
  return plain.endsWith(ending) && isVowelLetter(plain[plain.length - ending.length - 1] ?? "");
};

/** Where the silent end of a word starts: its mute e, its -ent or its silent final consonants. */
function silentFrom(word: string): number {
  const several = vowelCount(word) > 1;
  // "vient", "devient": -ient after a consonant is the nasal ien, not the verb ending.
  const nasalIen = word.endsWith("ient") && !isVowelLetter(word[word.length - 5] ?? "");
  if (word.endsWith("ent") && !word.endsWith("ment") && !nasalIen && (several || vowelBeforeEnding(word, "ent"))) {
    return word.length - 3;
  }
  if (word.endsWith("es") && (several || vowelBeforeEnding(word, "es"))) return word.length - 2;
  if (word.endsWith("e") && (several || vowelBeforeEnding(word, "e"))) return word.length - 1;
  let end = word.length;
  while (end > 1 && SILENT_FINALS.has(word[end - 1])) end--;
  // "blanc", "banc": a c after a nasal is silent too.
  if (end < word.length && word[end - 1] === "c" && word[end - 2] === "n") end--;
  else if (end === word.length && word.endsWith("nc")) end--;
  if (word.slice(0, end).endsWith("er") && (several || vowelBeforeEnding(word.slice(0, end), "er"))) end--;
  return end;
}

const silent = (spot: Spot) => spot.at >= silentFrom(spot.word);
// The letter after this spot is the last one sounded.
const lastSounded = (spot: Spot) => spot.end === silentFrom(spot.word);
// Nothing sounded follows but consonants up to the end, or a consonant before another consonant.
const closed = (spot: Spot) => {
  const end = silentFrom(spot.word);
  const next = spot.word.slice(spot.end, end);
  return next.length > 0 && !isVowelLetter(next[0]) && (next.length === 1 || !isVowelLetter(next[1]));
};
// A vowel with n or m is nasal when neither a vowel nor another n/m follows.
const nasal = (letters: string, sound: string): Rule => ({
  letters,
  sounds: sound,
  when: (spot) => !beforeVowel(spot) && !"nmh".includes(letterAfter(spot) || "-"),
});

// e alone: e before a silent z, r or d ("chez", "aimer", "pied"), ɛ before a
// silent t or a sounded final or doubled consonant ("et", "avec", "belle"), ə
// otherwise ("petit", "je").
function plainE(spot: Spot): string {
  const end = silentFrom(spot.word);
  if (lastSounded(spot) && end < spot.word.length) return "zrd".includes(spot.word[end]) ? "e" : "ɛ";
  if (closed(spot) || letterAfter(spot) === "x") return "ɛ";
  return "ə";
}

const RULES = compileRules([
  { letters: "eau", sounds: "o" },
  { letters: "au", sounds: "o" },
  { letters: "aim", sounds: "ɛ~", when: (spot) => !beforeVowel(spot) && letterAfter(spot) !== "m" },
  { letters: "ain", sounds: "ɛ~", when: (spot) => !beforeVowel(spot) && letterAfter(spot) !== "n" },
  { letters: "ein", sounds: "ɛ~", when: (spot) => !beforeVowel(spot) && letterAfter(spot) !== "n" },
  { letters: "ai", sounds: "ɛ" },
  { letters: "aî", sounds: "ɛ" },
  { letters: "ei", sounds: "ɛ" },
  { letters: "ey", sounds: "ɛ j" },
  { letters: "ay", sounds: "ɛ j", when: beforeVowel },
  { letters: "ay", sounds: "ɛ" },
  { letters: "oin", sounds: "w ɛ~", when: (spot) => !beforeVowel(spot) && letterAfter(spot) !== "n" },
  { letters: "oi", sounds: "w a" },
  { letters: "oî", sounds: "w a" },
  { letters: "oy", sounds: "w a j" },
  // English loans: "cool", "boom".
  { letters: "oo", sounds: "u" },
  { letters: "ou", sounds: "w", when: beforeVowel },
  { letters: "ou", sounds: "u" },
  { letters: "où", sounds: "u" },
  { letters: "oû", sounds: "u" },
  { letters: "œu", sounds: (spot) => (closed(spot) || lastSounded(spot) ? "œ" : "ø") },
  { letters: "eu", sounds: (spot) => (closed(spot) ? "œ" : "ø") },
  { letters: "oeu", sounds: (spot) => (closed(spot) ? "œ" : "ø") },
  { letters: "ien", sounds: "j ɛ~", when: (spot) => !beforeVowel(spot) && letterAfter(spot) !== "n" },
  { letters: "emm", sounds: "a m" },
  nasal("an", "ɑ~"),
  nasal("am", "ɑ~"),
  nasal("en", "ɑ~"),
  nasal("em", "ɑ~"),
  nasal("in", "ɛ~"),
  nasal("im", "ɛ~"),
  nasal("yn", "ɛ~"),
  nasal("ym", "ɛ~"),
  nasal("on", "ɔ~"),
  nasal("om", "ɔ~"),
  nasal("un", "œ~"),
  nasal("um", "œ~"),
  { letters: "aill", sounds: "a j" },
  { letters: "ail", sounds: "a j", when: lastSounded },
  { letters: "eill", sounds: "ɛ j" },
  { letters: "eil", sounds: "ɛ j", when: lastSounded },
  { letters: "ill", sounds: (spot) => (afterVowel(spot) ? "j" : "i j") },
  { letters: "a", sounds: "a" },
  { letters: "à", sounds: "a" },
  { letters: "â", sounds: "ɑ" },
  { letters: "é", sounds: "e" },
  { letters: "è", sounds: "ɛ" },
  { letters: "ê", sounds: "ɛ" },
  { letters: "ë", sounds: "ɛ" },
  { letters: "e", sounds: plainE },
  { letters: "i", sounds: "i" },
  { letters: "î", sounds: "i" },
  { letters: "ï", sounds: "i!" },
  { letters: "o", sounds: (spot) => (closed(spot) ? "ɔ" : "o") },
  { letters: "ô", sounds: "o" },
  { letters: "u", sounds: "ɥ", when: (spot) => beforeVowel(spot) && letterAfter(spot) !== "e" },
  { letters: "u", sounds: "y" },
  { letters: "û", sounds: "y" },
  { letters: "ü", sounds: "y" },
  { letters: "y", sounds: "j", when: (spot) => afterVowel(spot) && beforeVowel(spot) },
  { letters: "y", sounds: "i" },
  { letters: "œ", sounds: "œ" },
  { letters: "b", sounds: "b" },
  { letters: "ç", sounds: "s" },
  { letters: "cc", sounds: "k s", when: beforeFront },
  { letters: "ch", sounds: "ʃ" },
  { letters: "c", sounds: "s", when: beforeFront },
  { letters: "c", sounds: "k" },
  { letters: "d", sounds: "d" },
  { letters: "f", sounds: "f" },
  { letters: "gn", sounds: "ɲ" },
  { letters: "gu", sounds: "g", when: beforeFront },
  { letters: "ge", sounds: "ʒ", when: (spot) => "aou".includes(letterAfter(spot) || "-") },
  { letters: "g", sounds: "ʒ", when: beforeFront },
  { letters: "g", sounds: "g" },
  { letters: "h", sounds: "" },
  { letters: "j", sounds: "ʒ" },
  { letters: "k", sounds: "k" },
  { letters: "l", sounds: "l" },
  { letters: "m", sounds: "m" },
  { letters: "n", sounds: "n" },
  { letters: "ph", sounds: "f" },
  { letters: "p", sounds: "p" },
  { letters: "qu", sounds: "k" },
  { letters: "q", sounds: "k" },
  { letters: "r", sounds: "ʁ" },
  { letters: "sc", sounds: "s", when: beforeFront },
  { letters: "ss", sounds: "s" },
  { letters: "s", sounds: "z", when: (spot) => afterVowel(spot) && beforeVowel(spot) },
  { letters: "s", sounds: "s" },
  { letters: "th", sounds: "t" },
  // "nation", "émotions", but not "question".
  { letters: "tion", sounds: "s j ɔ~", when: (spot) => letterBefore(spot) !== "s" },
  { letters: "t", sounds: "t" },
  { letters: "v", sounds: "v" },
  { letters: "w", sounds: "w" },
  { letters: "x", sounds: "g z", when: (spot) => letterBefore(spot) === "e" && spot.at === 1 && beforeVowel(spot) },
  { letters: "x", sounds: "k s" },
  { letters: "z", sounds: "z" },
] satisfies Rule[]);

// A clitic before an apostrophe: "c'est", "j'ai", "qu'il".
const ELIDED: Readonly<Record<string, string>> = { c: "s", ç: "s", j: "ʒ", qu: "k" };

// -- Functions ----------------------------------------------------------------

// Every letter in the silent end of a word is silent, whatever rule its spelling starts.
const RULES_WITH_SILENT_END = new Map(
  [...RULES.entries()].map(([letter, rules]) => [
    letter,
    [{ letters: letter, sounds: "", when: silent } satisfies Rule, ...rules],
  ]),
);

function readPiece(piece: string, elided: boolean): WordReading {
  if (elided && vowelCount(piece) === 0) {
    const clitic = ELIDED[piece];
    return clitic ? { sounds: clitic.split(" "), guessed: false } : applyRules(piece, RULES);
  }
  return listedReading(piece, EXCEPTIONS) ?? applyRules(piece, RULES_WITH_SILENT_END);
}

function readFrench(word: string): WordReading {
  return readWithRules(word, readPiece, { glide: true, diphthongs: "never" });
}

// -- Exports ------------------------------------------------------------------

export { readFrench };
